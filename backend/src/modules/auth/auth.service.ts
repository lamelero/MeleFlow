import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "../../lib/rate-limit";
import { logSecurityEvent } from "../../lib/security-log";
import { sendEmail, buildOTPEmail, isEmailConfigured } from "../../lib/email-service";
import { t } from "../../lib/email-i18n";
import {
  generateSecret,
  encryptSecret,
  decryptSecret,
  verifyTOTP,
  generateRecoveryCodes,
  verifyRecoveryCode,
  generateTOTPUri,
} from "../../lib/two-factor";
import type { RegisterInput, LoginInput, Verify2FALoginInput, UpdateProfileInput } from "./auth.schema";

export class AuthService {
  async register(input: RegisterInput) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "allowRegistration" },
    });
    const allowed = setting
      ? setting.value === "true"
      : env.ALLOW_REGISTRATION;
    if (!allowed) {
      throw new AppError(403, "Registration is disabled. Contact an administrator.");
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
    });

    if (existing) {
      const field = existing.email === input.email ? "email" : "username";
      throw new AppError(409, `${field} already taken`);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const userCount = await prisma.user.count();
    const role = userCount === 0 ? Role.ADMIN : Role.USER;

    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        role,
      },
    });

    return this.buildTokens(user.id, user.role, false);
  }

  async login(input: LoginInput, ip?: string, userAgent?: string, deviceToken?: string) {
    // Check rate limit first
    const rateCheck = await checkRateLimit(input.email, ip || "unknown");
    if (rateCheck.blocked) {
      await logSecurityEvent({
        action: "LOGIN_BLOCKED",
        details: JSON.stringify({ email: input.email, reason: "rate_limit" }),
        ip,
        userAgent,
      });
      throw new AppError(
        429,
        `Too many login attempts. Try again in ${rateCheck.lockoutMinutes} minutes.`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.isActive) {
      await recordFailedAttempt(input.email, ip || "unknown", userAgent);
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        details: JSON.stringify({ email: input.email, reason: "user_not_found" }),
        ip,
        userAgent,
      });
      throw new AppError(401, "Invalid credentials");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      await recordFailedAttempt(input.email, ip || "unknown", userAgent);
      await logSecurityEvent({
        action: "LOGIN_FAILED",
        details: JSON.stringify({ email: input.email, reason: "wrong_password" }),
        ip,
        userAgent,
      });
      throw new AppError(401, "Invalid credentials");
    }

    // Clear failed attempts on successful password verification
    await clearFailedAttempts(input.email, ip || "unknown");

    // Check for trusted device (2FA bypass)
    if (deviceToken) {
      const trusted = await this.checkTrustedDevice(user.id, deviceToken);
      if (trusted) {
        return this.buildTokens(user.id, user.role, input.rememberMe);
      }
    }

    // If 2FA is enabled, return a temporary token instead of full session
    if (user.isTwoFactorEnabled) {
      const twoFactorToken = jwt.sign(
        { sub: user.id, type: "2fa" },
        env.JWT_SECRET,
        { expiresIn: "5m" } as jwt.SignOptions,
      );

      await logSecurityEvent({
        userId: user.id,
        action: "2FA_REQUIRED",
        details: JSON.stringify({ email: input.email }),
        ip,
        userAgent,
      });

      return {
        requiresTwoFactor: true,
        twoFactorToken,
        twoFactorMethod: "totp",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      };
    }

    // If email is not configured, login directly (fresh install with no SMTP yet)
    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      return this.buildTokens(user.id, user.role, input.rememberMe);
    }

    // Generate and send OTP email for users without 2FA
    const otpToken = jwt.sign(
      { sub: user.id, type: "otp" },
      env.JWT_SECRET,
      { expiresIn: "5m" } as jwt.SignOptions,
    );

    await this.generateAndSendOTP(user);

    await logSecurityEvent({
      userId: user.id,
      action: "OTP_REQUIRED",
      details: JSON.stringify({ email: input.email }),
      ip,
      userAgent,
    });

    return {
      requiresTwoFactor: true,
      twoFactorToken: otpToken,
      twoFactorMethod: "email",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async verify2FA(input: Verify2FALoginInput, ip?: string, userAgent?: string) {
    // Verify the 2FA token JWT
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(input.twoFactorToken, env.JWT_SECRET) as { sub: string; type: string };
    } catch {
      throw new AppError(401, "Invalid or expired 2FA token. Please login again.");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new AppError(400, "User not found or deactivated");
    }

    let success = false;

    if (payload.type === "2fa") {
      if (!user.isTwoFactorEnabled || !user.twoFactorSecret) {
        throw new AppError(400, "2FA is not enabled for this account");
      }

      // Try TOTP code first
      const totpValid = await verifyTOTP(input.code, user.twoFactorSecret);
      if (totpValid) {
        await logSecurityEvent({
          userId: user.id,
          action: "2FA_VERIFIED",
          details: JSON.stringify({ method: "totp" }),
          ip,
          userAgent,
        });
        success = true;
      }

      // Try recovery code
      if (!success) {
        const recoveryResult = await verifyRecoveryCode(input.code, user.recoveryCodes);
        if (recoveryResult.valid) {
          await prisma.user.update({
            where: { id: user.id },
            data: { recoveryCodes: recoveryResult.remainingCodesJson },
          });
          await logSecurityEvent({
            userId: user.id,
            action: "2FA_VERIFIED",
            details: JSON.stringify({ method: "recovery_code" }),
            ip,
            userAgent,
          });
          success = true;
        }
      }
    }

    if (payload.type === "otp") {
      // Find active OTP codes for user
      const codes = await prisma.verificationCode.findMany({
        where: {
          userId: user.id,
          type: "LOGIN_OTP",
          usedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const vc of codes) {
        const valid = await bcrypt.compare(input.code, vc.code);
        if (valid) {
          await prisma.verificationCode.update({
            where: { id: vc.id },
            data: { usedAt: new Date() },
          });
          // Clean up old codes
          await prisma.verificationCode.deleteMany({
            where: { userId: user.id, type: "LOGIN_OTP", usedAt: { not: null } },
          });
          await logSecurityEvent({
            userId: user.id,
            action: "OTP_VERIFIED",
            ip,
            userAgent,
          });
          success = true;
          break;
        }
      }

      if (!success) {
        // Increment attempts for all active codes
        await prisma.verificationCode.updateMany({
          where: { userId: user.id, type: "LOGIN_OTP", usedAt: null, expiresAt: { gt: new Date() } },
          data: { attempts: { increment: 1 } },
        });
      }
    }

    if (!success) {
      await logSecurityEvent({
        userId: user.id,
        action: "2FA_FAILED",
        ip,
        userAgent,
      });
      throw new AppError(401, "Invalid code. Please try again.");
    }

    const tokens = await this.buildTokens(user.id, user.role, false);

    // Trust this device?
    if (input.trustDevice) {
      const deviceToken = await this.createTrustedDevice(user.id, userAgent, ip);
      return { ...tokens, deviceToken };
    }

    return tokens;
  }

  private async checkTrustedDevice(userId: string, rawToken: string): Promise<boolean> {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const trusted = await prisma.trustedDevice.findUnique({
      where: { tokenHash },
    });
    if (!trusted || trusted.userId !== userId || trusted.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  private async createTrustedDevice(userId: string, userAgent?: string, ip?: string): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Derive a human-readable label from user agent
    const label = userAgent
      ? userAgent.split("/")[0]?.split(" ")[0] || userAgent.slice(0, 30)
      : undefined;

    await prisma.trustedDevice.create({
      data: {
        userId,
        tokenHash,
        label,
        userAgent,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  async sendOTPCode(twoFactorToken: string) {
    let payload: { sub: string };
    try {
      payload = jwt.verify(twoFactorToken, env.JWT_SECRET) as { sub: string };
    } catch {
      throw new AppError(401, "Invalid or expired token. Please login again.");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new AppError(400, "User not found or deactivated");
    }

    // Check email is configured
    const emailConfigured = await isEmailConfigured();
    if (!emailConfigured) {
      throw new AppError(500, "Email is not configured. Set up SMTP in the admin panel first.");
    }

    // Rate limit: max 3 OTPs per hour
    const recentCount = await prisma.verificationCode.count({
      where: {
        userId: user.id,
        type: "LOGIN_OTP",
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentCount >= 3) {
      throw new AppError(429, "Too many OTP requests. Try again in an hour.");
    }

    await this.generateAndSendOTP(user);
    return { sent: true };
  }

  private async generateAndSendOTP(user: { id: string; email: string; notificationEmail?: string | null; language?: string }) {
    // Invalidate previous unused codes
    await prisma.verificationCode.updateMany({
      where: { userId: user.id, type: "LOGIN_OTP", usedAt: null },
      data: { expiresAt: new Date(0) },
    });

    // Generate 6-digit code
    const code = String(crypto.randomInt(100000, 999999));
    const hashed = await bcrypt.hash(code, 10);

    await prisma.verificationCode.create({
      data: {
        userId: user.id,
        code: hashed,
        type: "LOGIN_OTP",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send email
    const lang = user.language || "en";
    const to = user.notificationEmail || user.email;
    const subject = t(lang, "otpSubject");
    const html = buildOTPEmail(code, lang);

    const sent = await sendEmail(to, subject, html);
    if (!sent) {
      throw new AppError(500, "Failed to send verification email. Check SMTP configuration.");
    }
  }

  async refreshToken(rawToken: string, rememberMe: boolean) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new AppError(401, "Invalid or expired refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new AppError(401, "User not found or deactivated");
    }

    // Rotate: delete old token
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.buildTokens(user.id, user.role, rememberMe);
  }

  async logout(rawToken: string) {
    if (rawToken) {
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
  }

  async getMe(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          notificationEmail: true,
          bio: true,
          timezone: true,
          role: true,
          language: true,
          isTwoFactorEnabled: true,
          notificationPrefs: true,
        },
      });

      if (!user) throw new AppError(404, "User not found");

      // Parse notificationPrefs for frontend
      return {
        ...user,
        notificationPrefs: user.notificationPrefs ? JSON.parse(user.notificationPrefs) : { email: true, push: true, browser: true },
      };
    } catch (err) {
      if (err instanceof AppError) throw err;

      // Fallback: columns may not exist yet (pre-migration)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          language: true,
          isTwoFactorEnabled: true,
          notificationPrefs: true,
        },
      });

      if (!user) throw new AppError(404, "User not found");
      return {
        ...user,
        notificationPrefs: user.notificationPrefs ? JSON.parse(user.notificationPrefs) : { email: true, push: true, browser: true },
      };
    }
  }

  async updateLanguage(userId: string, language: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { language },
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const data: Record<string, string | null> = {};

    if (input.displayName !== undefined) {
      data.displayName = input.displayName || null;
    }
    if (input.notificationEmail !== undefined) {
      data.notificationEmail = input.notificationEmail || null;
    }
    if (input.bio !== undefined) {
      data.bio = input.bio || null;
    }
    if (input.timezone !== undefined) {
      data.timezone = input.timezone || null;
    }

    if (Object.keys(data).length === 0) {
      return this.getMe(userId);
    }

    await prisma.user.update({
      where: { id: userId },
      data,
    });

    return this.getMe(userId);
  }

  // ── 2FA Management ─────────────────────────────

  async setup2FA(userId: string) {
    const secret = generateSecret();
    const encrypted = encryptSecret(secret);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new AppError(404, "User not found");

    const uri = generateTOTPUri(secret, user.email);

    const { plainCodes, hashedCodes } = await generateRecoveryCodes();

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encrypted,
        recoveryCodes: hashedCodes,
      },
    });

    await logSecurityEvent({
      userId,
      action: "2FA_SETUP_INITIATED",
    });

    return { secret, uri, recoveryCodes: plainCodes };
  }

  async enable2FA(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new AppError(400, "Please setup 2FA first");
    }

    const valid = await verifyTOTP(code, user.twoFactorSecret);
    if (!valid) {
      throw new AppError(400, "Invalid verification code");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    await logSecurityEvent({
      userId,
      action: "2FA_ENABLED",
    });

    return { enabled: true };
  }

  async disable2FA(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(400, "Invalid password");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: null,
      },
    });

    await logSecurityEvent({
      userId,
      action: "2FA_DISABLED",
    });

    return { enabled: false };
  }

  async get2FAStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorEnabled: true, twoFactorSecret: true, email: true },
    });

    let uri: string | null = null;
    if (user?.twoFactorSecret && !user.isTwoFactorEnabled) {
      try {
        const secret = decryptSecret(user.twoFactorSecret);
        uri = generateTOTPUri(secret, user.email);
      } catch {
        // secret corrupted, will need to re-setup
      }
    }

    return {
      isTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
      isConfigured: !!user?.twoFactorSecret,
      uri,
    };
  }

  async searchUsers(query: string, currentUserId: string) {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
      take: 10,
    });
    return users;
  }

  async getRecoveryCodes(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(400, "Invalid password");
    }

    const { plainCodes, hashedCodes } = await generateRecoveryCodes();

    await prisma.user.update({
      where: { id: userId },
      data: { recoveryCodes: hashedCodes },
    });

    return { recoveryCodes: plainCodes };
  }

  // ── Token Building ─────────────────────────────

  private async buildTokens(userId: string, role: string, rememberMe: boolean) {
    const accessToken = jwt.sign(
      { sub: userId, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );

    const rawToken = crypto.randomBytes(48).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const ttlSeconds = this.parseExpiry(env.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, notificationEmail: true, bio: true, timezone: true, role: true, language: true, notificationPrefs: true },
    });

    const parsedPrefs = user?.notificationPrefs ? JSON.parse(user.notificationPrefs) : { email: true, push: true, browser: true };

    return {
      accessToken,
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
      rememberMe,
      user: { ...user, notificationPrefs: parsedPrefs },
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 86400;
    const value = Number.parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] || 86400);
  }
}
