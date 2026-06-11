import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";

// BigInt serialization for JSON responses (Prisma uses BigInt for storage counts)
(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return Number(this);
};
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fjwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { ZodError } from "zod";
import { env } from "./config/env";
import { AppError } from "./lib/app-error";
import { authRoutes } from "./modules/auth/auth.routes";
import { taskRoutes } from "./modules/tasks/tasks.routes";
import { listRoutes } from "./modules/lists/lists.routes";
import { tagRoutes } from "./modules/tags/tags.routes";
import { habitRoutes } from "./modules/habits/habits.routes";
import { habitCategoryRoutes } from "./modules/habits/habit-categories.routes";
import { pomodoroRoutes } from "./modules/pomodoro/pomodoro.routes";
import { notificationRoutes } from "./modules/notifications/notifications.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { icsCalendarRoutes } from "./modules/ics-calendars/ics-calendars.routes";

export async function buildApp(opts: Record<string, unknown> = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    trustProxy: true,
    ...opts,
  });

  // ── Plugins ──────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  const configuredOrigin = env.CORS_ORIGIN;
  await app.register(cors, {
    origin: (configuredOrigin
      ? async (origin: string | undefined) => {
          if (!origin) return true;
          if (origin === configuredOrigin) return true;
          try {
            const hostname = new URL(origin).hostname;
            if (hostname === "localhost" || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) return true;
          } catch {}
          return false;
        }
      : true) as any,
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  await app.register(fjwt, { secret: env.JWT_SECRET });

  await app.register(cookie, {
    secret: env.JWT_SECRET,
    parseOptions: {},
  });

  await app.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap (dynamic check inside service)
  });

  await app.register(fastifyStatic, {
    root: path.resolve("uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // ── Auth decorator ───────────────────────────
  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    },
  );

  // ── Error handler ────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation failed",
        details: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }

    if (error.statusCode === 429) {
      return reply.code(429).send({ error: "Too many requests" });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  // ── Routes ───────────────────────────────────
  app.get("/api/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(taskRoutes, { prefix: "/api/tasks" });
  await app.register(listRoutes, { prefix: "/api/lists" });
  await app.register(tagRoutes, { prefix: "/api/tags" });
  await app.register(habitRoutes, { prefix: "/api/habits" });
  await app.register(habitCategoryRoutes, { prefix: "/api" });
  await app.register(notificationRoutes, { prefix: "/api" });
  await app.register(pomodoroRoutes, { prefix: "/api/pomodoro" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(settingsRoutes, { prefix: "/api" });
  await app.register(icsCalendarRoutes, { prefix: "/api/ics-calendars" });

  return app;
}
