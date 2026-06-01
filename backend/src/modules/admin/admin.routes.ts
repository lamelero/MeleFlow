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

  app.post("/logo", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const allowedMimes = ["image/png", "image/svg+xml"];
    if (!allowedMimes.includes(file.mimetype)) {
      return reply.code(400).send({ error: "Only PNG and SVG files are allowed" });
    }

    const ext = file.mimetype === "image/png" ? ".png" : ".svg";
    const maxSize = 2 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        return reply.code(400).send({ error: "File size exceeds 2MB limit" });
      }
      chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);
    const result = await service.uploadLogo(data, ext);
    return reply.send(result);
  });

  app.delete("/logo", async (_req, reply) => {
    const result = await service.removeLogo();
    return reply.send(result);
  });
}
