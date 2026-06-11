import { FastifyInstance } from "fastify";
import { NotificationService } from "./notifications.service";

export async function notificationRoutes(app: FastifyInstance) {
  const service = new NotificationService();

  app.get("/tokens", { onRequest: [app.authenticate] }, async (req, reply) => {
    const tokens = await service.getTokens(req.user.sub);
    return reply.send({ tokens: tokens.map((t) => ({ platform: t.platform, createdAt: t.createdAt })) });
  });

  app.post("/register-token", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token, platform } = req.body as { token: string; platform?: string };
    if (!token) return reply.code(400).send({ error: "Token is required" });
    await service.registerToken(req.user.sub, token, platform || "android");
    return reply.send({ ok: true });
  });

  app.post("/unregister-token", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token } = req.body as { token: string };
    if (!token) return reply.code(400).send({ error: "Token is required" });
    await service.unregisterToken(req.user.sub, token);
    return reply.send({ ok: true });
  });
}
