import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fjwt from "@fastify/jwt";
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
import { pomodoroRoutes } from "./modules/pomodoro/pomodoro.routes";
import { adminRoutes } from "./modules/admin/admin.routes";

export async function buildApp(opts: Record<string, unknown> = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    ...opts,
  });

  // ── Plugins ──────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  await app.register(fjwt, { secret: env.JWT_SECRET });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
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
  await app.register(pomodoroRoutes, { prefix: "/api/pomodoro" });
  await app.register(adminRoutes, { prefix: "/api/admin" });

  return app;
}
