import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../../config/database";
import { AuthService } from "./auth.service";
import { validateFile } from "../../utils/file-validator";
import { parseNotificationPrefs } from "../../utils/notification-prefs";
import {
  registerSchema,
  loginSchema,
  verify2FASchema,
  refreshSchema,
  updateLanguageSchema,
  updateProfileSchema,
  enable2FASchema,
  disable2FASchema,
  sendOTPSchema,
  getRecoveryCodesSchema,
  updateNotificationPrefsSchema,
  searchUsersQuerySchema,
} from "./auth.schema";

const service = new AuthService();

const isSecure = process.env.NODE_ENV === "production" || process.env.FORCE_SECURE === "true";

const REFRESH_COOKIE = "refreshToken";
const DEVICE_COOKIE = "device_token";
const COOKIE_PATH = "/api/auth";
const SAME_SITE = "lax" as const;

function setRefreshCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: string,
  rememberMe: boolean,
) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined;
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: SAME_SITE,
    path: COOKIE_PATH,
    ...(maxAge ? { maxAge } : {}),
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

function setDeviceCookie(reply: FastifyReply, token: string) {
  reply.setCookie(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: SAME_SITE,
    path: COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

export async function authRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();

  // ── Register (public) ──────────────────────
  s.post("/register", {
    schema: { body: registerSchema },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const result = await service.register(req.body);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, false);
    reply.code(201).send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  });

  // ── Login (public) ─────────────────────────
  s.post("/login", {
    schema: { body: loginSchema },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const { email, password, rememberMe } = req.body;
    const result = await service.login(
      { email, password, rememberMe },
      req.ip,
      req.headers["user-agent"],
      req.cookies?.[DEVICE_COOKIE],
    );

    if ("requiresTwoFactor" in result) {
      reply.send({
        requiresTwoFactor: true,
        twoFactorToken: result.twoFactorToken,
        twoFactorMethod: result.twoFactorMethod,
        user: result.user,
      });
      return;
    }

    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, rememberMe);
    reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  });

  // ── Verify 2FA (public) ────────────────────
  s.post("/verify-2fa", {
    schema: { body: verify2FASchema },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const result = await service.verify2FA(req.body, req.ip, req.headers["user-agent"]);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, false);

    if ("deviceToken" in result && result.deviceToken) {
      setDeviceCookie(reply, result.deviceToken);
    }

    reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  });

  // ── Send OTP (public) ──────────────────────
  s.post("/2fa/send-otp", {
    schema: { body: sendOTPSchema },
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    await service.sendOTPCode(req.body.twoFactorToken);
    reply.send({ sent: true });
  });

  // ── Refresh token (public) ─────────────────
  s.post("/refresh", {
    schema: { body: refreshSchema },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const token = req.body.refreshToken || req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      reply.code(401).send({ error: "No refresh token" });
      return;
    }
    const result = await service.refreshToken(token, req.body.rememberMe);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, req.body.rememberMe);
    reply.send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  });

  // ── Logout (public) ────────────────────────
  s.post("/logout", async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await service.logout(token);
    clearRefreshCookie(reply);
    reply.code(204).send();
  });

  // ── Get current user (authenticated) ───────
  s.get("/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    reply.send(await service.getMe(req.user.sub));
  });

  // ── Update language (authenticated) ────────
  s.patch("/language", {
    onRequest: [app.authenticate],
    schema: { body: updateLanguageSchema },
  }, async (req, reply) => {
    await service.updateLanguage(req.user.sub, req.body.language);
    reply.code(204).send();
  });

  // ── Update profile (authenticated) ─────────
  s.patch("/profile", {
    onRequest: [app.authenticate],
    schema: { body: updateProfileSchema },
  }, async (req, reply) => {
    reply.send(await service.updateProfile(req.user.sub, req.body));
  });

  // ── Upload avatar (authenticated) ──────────
  s.post("/avatar", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user;
    const data = await req.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const maxSize = 5 * 1024 * 1024;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        reply.code(400).send({ error: "File size exceeds 5MB limit" });
        return;
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const validation = validateFile(buffer, data.mimetype, maxSize, allowedAvatarTypes);
    if (!validation.valid) {
      reply.code(400).send({ error: validation.error });
      return;
    }

    const ext = ".png";
    const filename = `avatar-${sub}${ext}`;
    const uploadDir = path.resolve("uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const avatarUrl = `/uploads/${filename}`;

    await prisma.user.update({
      where: { id: sub },
      data: { avatarUrl },
    });

    reply.send({ avatarUrl });
  });

  // ── Get notification prefs (authenticated) ─
  s.get("/notification-prefs", { onRequest: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { notificationPrefs: true },
    });
    const prefs = parseNotificationPrefs(user?.notificationPrefs);
    reply.send(prefs);
  });

  // ── Update notification prefs (authenticated)
  s.patch("/notification-prefs", {
    onRequest: [app.authenticate],
    schema: { body: updateNotificationPrefsSchema },
  }, async (req, reply) => {
    const { sub } = req.user;
    const body = req.body;
    const existing = await prisma.user.findUnique({
      where: { id: sub },
      select: { notificationPrefs: true },
    });
    const current = parseNotificationPrefs(existing?.notificationPrefs);
    const merged = { ...current, ...body };
    await prisma.user.update({
      where: { id: sub },
      data: { notificationPrefs: JSON.stringify(merged) },
    });
    reply.send(merged);
  });

  // ── Search users (authenticated) ───────────
  s.get("/users/search", {
    onRequest: [app.authenticate],
    schema: { querystring: searchUsersQuerySchema },
  }, async (req, reply) => {
    reply.send(await service.searchUsers(req.query.q, req.user.sub));
  });

  // ── 2FA Management (authenticated) ─────────

  s.get("/2fa/status", { onRequest: [app.authenticate] }, async (req, reply) => {
    reply.send(await service.get2FAStatus(req.user.sub));
  });

  s.post("/2fa/setup", { onRequest: [app.authenticate] }, async (req, reply) => {
    reply.send(await service.setup2FA(req.user.sub));
  });

  s.post("/2fa/enable", {
    onRequest: [app.authenticate],
    schema: { body: enable2FASchema },
  }, async (req, reply) => {
    reply.send(await service.enable2FA(req.user.sub, req.body.code));
  });

  s.post("/2fa/disable", {
    onRequest: [app.authenticate],
    schema: { body: disable2FASchema },
  }, async (req, reply) => {
    reply.send(await service.disable2FA(req.user.sub, req.body.password));
  });

  s.post("/2fa/recovery-codes", {
    onRequest: [app.authenticate],
    schema: { body: getRecoveryCodesSchema },
  }, async (req, reply) => {
    reply.send(await service.getRecoveryCodes(req.user.sub, req.body.password));
  });
}
