import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { NotificationService } from "./notifications.service";
import { sendPushToUser } from "../../lib/push-service";

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.string().optional().default("android"),
});

const unregisterTokenSchema = z.object({
  token: z.string().min(1),
});

export async function notificationRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  const service = new NotificationService();

  s.get("/notifications/tokens", async (req, reply) => {
    const tokens = await service.getTokens(req.user.sub);
    reply.send({ tokens: tokens.map((t) => ({ platform: t.platform, createdAt: t.createdAt })) });
  });

  s.post("/notifications/register-token", { schema: { body: registerTokenSchema } }, async (req, reply) => {
    await service.registerToken(req.user.sub, req.body.token, req.body.platform);
    reply.send({ ok: true });
  });

  s.post("/notifications/unregister-token", { schema: { body: unregisterTokenSchema } }, async (req, reply) => {
    await service.unregisterToken(req.user.sub, req.body.token);
    reply.send({ ok: true });
  });

  s.post("/notifications/test-push", async (req, reply) => {
    try {
      await sendPushToUser(req.user.sub, "Test push", "If you see this, push notifications work!");
      reply.send({ ok: true, message: "Push sent" });
    } catch (err: unknown) {
      reply.code(500).send({ ok: false, error: (err as Error).message || "Push failed" });
    }
  });
}
