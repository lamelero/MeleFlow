import { FastifyInstance } from "fastify";
import { NotificationService } from "./notifications.service";
import { sendPushToUser } from "../../lib/push-service";

export async function notificationRoutes(app: FastifyInstance) {
  const service = new NotificationService();

  app.get("/notifications/tokens", { onRequest: [app.authenticate] }, async (req, reply) => {
    const tokens = await service.getTokens(req.user.sub);
    return reply.send({ tokens: tokens.map((t) => ({ platform: t.platform, createdAt: t.createdAt })) });
  });

  app.post("/notifications/register-token", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token, platform } = req.body as { token: string; platform?: string };
    if (!token) return reply.code(400).send({ error: "Token is required" });
    await service.registerToken(req.user.sub, token, platform || "android");
    return reply.send({ ok: true });
  });

  app.post("/notifications/unregister-token", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { token } = req.body as { token: string };
    if (!token) return reply.code(400).send({ error: "Token is required" });
    await service.unregisterToken(req.user.sub, token);
    return reply.send({ ok: true });
  });

  app.post("/notifications/test-push", { onRequest: [app.authenticate] }, async (req, reply) => {
    await sendPushToUser(req.user.sub, "Test push", "If you see this, push notifications work!");
    return reply.send({ ok: true, message: "Push sent" });
  });
}
