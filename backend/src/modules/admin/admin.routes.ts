import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { updateUserSchema, updateSettingsSchema } from "./admin.schema";
import { AdminService } from "./admin.service";

const service = new AdminService();

async function isAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    if (req.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", isAdmin);

  app.get("/users", async (_req, reply) => {
    const users = await service.getUsers();
    return reply.send(users);
  });

  app.put("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateUserSchema.parse(req.body);
    const result = await service.updateUser(req.user.sub, id, input);
    return reply.send(result);
  });

  app.get("/stats", async (_req, reply) => {
    const stats = await service.getStats();
    return reply.send(stats);
  });

  app.get("/settings", async (_req, reply) => {
    const settings = await service.getSettings();
    return reply.send(settings);
  });

  app.patch("/settings", async (req, reply) => {
    const input = updateSettingsSchema.parse(req.body);
    const settings = await service.updateSettings(input);
    return reply.send(settings);
  });

  app.get("/security-logs", async (req, reply) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = Math.min(Number(query.limit) || 50, 200);
    const offset = Number(query.offset) || 0;
    const logs = await service.getSecurityLogs(limit, offset);
    return reply.send(logs);
  });

  app.post("/test-email", async (req, reply) => {
    const { prisma } = await import("../../config/database");
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    const { sendEmail } = await import("../../lib/email-service");
    const ok = await sendEmail(
      user.email,
      "Test email from MeleNotes",
      "<p>If you're reading this, your SMTP configuration works!</p>",
    );
    if (ok) {
      return reply.send({ ok: true, message: "Test email sent" });
    }
    return reply.code(500).send({ error: "Failed to send test email. Check your SMTP settings." });
  });
}
