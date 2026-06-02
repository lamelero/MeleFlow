import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../../config/database";
import {
  registerSchema,
  loginSchema,
  verify2FASchema,
  refreshSchema,
  updateLanguageSchema,
  updateProfileSchema,
  setup2FASchema,
  enable2FASchema,
  disable2FASchema,
  getRecoveryCodesSchema,
} from "./auth.schema";
import { AuthService } from "./auth.service";

const service = new AuthService();

const REFRESH_COOKIE = "refreshToken";
const COOKIE_PATH = "/api/auth";
const SAME_SITE = "lax" as const;

function setRefreshCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: string,
  rememberMe: boolean,
) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : undefined; // 30 days or session
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: SAME_SITE,
    path: COOKIE_PATH,
    ...(maxAge ? { maxAge } : {}),
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const result = await service.register(input);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, false);
    return reply.code(201).send({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post("/login", async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.headers["user-agent"];
    const result = await service.login(input, ip, userAgent);

    if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
      return reply.send({
        requiresTwoFactor: true,
        twoFactorToken: result.twoFactorToken,
        user: result.user,
      });
    }

    const tokens = result as Awaited<ReturnType<typeof service.register>>;
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshTokenExpiresAt, input.rememberMe);
    return reply.send({
      accessToken: tokens.accessToken,
      user: tokens.user,
    });
  });

  app.post("/verify-2fa", async (req, reply) => {
    const input = verify2FASchema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.headers["user-agent"];
    const result = await service.verify2FA(input, ip, userAgent);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, false);
    return reply.send({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post("/refresh", async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "No refresh token" });
    }
    const { rememberMe } = refreshSchema.parse(req.body);
    const result = await service.refreshToken(token, rememberMe);
    setRefreshCookie(reply, result.refreshToken, result.refreshTokenExpiresAt, rememberMe);
    return reply.send({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post("/logout", async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await service.logout(token);
    }
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  app.get(
    "/me",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const user = await service.getMe(sub);
      return reply.send(user);
    },
  );

  app.patch(
    "/language",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { language } = updateLanguageSchema.parse(req.body);
      await service.updateLanguage(sub, language);
      return reply.code(204).send();
    },
  );

  app.patch(
    "/profile",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const input = updateProfileSchema.parse(req.body);
      const user = await service.updateProfile(sub, input);
      return reply.send(user);
    },
  );

  app.post(
    "/avatar",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const ext = path.extname(data.filename) || ".png";
      const filename = `avatar-${sub}${ext}`;
      const uploadDir = path.resolve("uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      await fs.writeFile(filePath, Buffer.concat(chunks));

      const avatarUrl = `/uploads/${filename}`;

      await prisma.user.update({
        where: { id: sub },
        data: { avatarUrl },
      });

      return reply.send({ avatarUrl });
    },
  );

  // ── 2FA Management (authenticated) ──────────────

  app.get(
    "/users/search",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { q } = req.query as { q: string };
      if (!q || q.length < 1) return reply.send([]);
      const users = await service.searchUsers(q, sub);
      return reply.send(users);
    },
  );

  app.get(
    "/2fa/status",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const status = await service.get2FAStatus(sub);
      return reply.send(status);
    },
  );

  app.post(
    "/2fa/setup",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const result = await service.setup2FA(sub);
      return reply.send(result);
    },
  );

  app.post(
    "/2fa/enable",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { code } = enable2FASchema.parse(req.body);
      const result = await service.enable2FA(sub, code);
      return reply.send(result);
    },
  );

  app.post(
    "/2fa/disable",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { password } = disable2FASchema.parse(req.body);
      const result = await service.disable2FA(sub, password);
      return reply.send(result);
    },
  );

  app.post(
    "/2fa/recovery-codes",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub } = req.user;
      const { password } = getRecoveryCodesSchema.parse(req.body);
      const result = await service.getRecoveryCodes(sub, password);
      return reply.send(result);
    },
  );
}
