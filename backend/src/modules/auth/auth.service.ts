import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "../../lib/rate-limit";
import { logSecurityEvent } from "../../lib/security-log";
import {
  generateSecret,
  encryptSecret,
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

  async login(input: LoginInput, ip?: string, userAgent?: string) {
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

    // If 2FA is enabled, return a temporary token instead of full session
    if (user.isTwoFactorEnabled) {
      const tempToken = crypto.randomBytes(32).toString("hex");
      // Store temp token in DB with 5 min expiry (we use a simple approach: store in user record)
      // Actually, we'll use a temporary approach - store in a field or use a separate mechanism
      // For simplicity, we'll generate a short-lived JWT
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
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      };
    }

    await logSecurityEvent({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ip,
      userAgent,
    });

    return this.buildTokens(user.id, user.role, false);
  }

  async verify2FA(input: Verify2FALoginInput, ip?: string, userAgent?: string) {
    // Verify the 2FA token JWT
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(input.twoFactorToken, env.JWT_SECRET) as { sub: string; type: string };
      if (payload.type !== "2fa") throw new Error("Invalid token type");
    } catch {
      throw new AppError(401, "Invalid or expired 2FA token. Please login again.");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
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
      return this.buildTokens(user.id, user.role, false);
    }

    // Try recovery code
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

      return this.buildTokens(user.id, user.role, false);
    }

    await logSecurityEvent({
      userId: user.id,
      action: "2FA_FAILED",
      ip,
      userAgent,
    });

    throw new AppError(401, "Invalid 2FA code. Please try again.");
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
        },
      });

      if (!user) throw new AppError(404, "User not found");
      return user;
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
        },
      });

      if (!user) throw new AppError(404, "User not found");
      return user;
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
      select: { isTwoFactorEnabled: true, twoFactorSecret: true },
    });

    return {
      isTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
      isConfigured: !!user?.twoFactorSecret,
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
      select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, role: true, language: true, timezone: true },
    });

    return {
      accessToken,
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
      rememberMe,
      user,
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
