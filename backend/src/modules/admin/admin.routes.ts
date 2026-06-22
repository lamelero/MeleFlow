import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  updateUserSchema,
  updateSettingsSchema,
  wipeDataSchema,
  userIdParams,
  backupNameParams,
  securityLogsQuerySchema,
  backupSettingsBodySchema,
  logoVariantQuerySchema,
  testEmailBodySchema,
  createBackupBodySchema,
} from "./admin.schema";
import { AdminService } from "./admin.service";
import { BackupService } from "./backup.service";

const service = new AdminService();
const backupService = new BackupService();

async function isAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    if (req.user.role !== "ADMIN") {
      reply.code(403).send({ error: "Forbidden" });
      return;
    }
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
}

export async function adminRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", isAdmin);

  s.get("/users", async (_req, reply) => {
    reply.send(await service.getUsers());
  });

  s.put("/users/:id", { schema: { body: updateUserSchema, params: userIdParams } }, async (req, reply) => {
    reply.send(await service.updateUser(req.user.sub, req.params.id, req.body));
  });

  s.delete("/users/:id", { schema: { params: userIdParams } }, async (req, reply) => {
    await service.deleteUser(req.user.sub, req.params.id);
    reply.send({ deleted: true });
  });

  s.get("/stats", async (_req, reply) => {
    reply.send(await service.getStats());
  });

  s.get("/settings", async (_req, reply) => {
    reply.send(await service.getSettings());
  });

  s.patch("/settings", { schema: { body: updateSettingsSchema } }, async (req, reply) => {
    reply.send(await service.updateSettings(req.body));
  });

  s.get("/security-logs", { schema: { querystring: securityLogsQuerySchema } }, async (req, reply) => {
    reply.send(await service.getSecurityLogs(req.query.limit, req.query.offset));
  });

  s.post("/test-email", { schema: { body: testEmailBodySchema } }, async (req, reply) => {
    const { prisma } = await import("../../config/database");
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }
    const { sendEmail } = await import("../../lib/email-service");
    const ok = await sendEmail(
      req.body.to || user.email,
      "Test email from MeleFlow",
      "<p>If you're reading this, your SMTP configuration works!</p>",
    );
    if (ok) {
      reply.send({ ok: true, message: "Test email sent" });
      return;
    }
    reply.code(500).send({ error: "Failed to send test email. Check your SMTP settings." });
  });

  s.post("/logo", { schema: { querystring: logoVariantQuerySchema } }, async (req, reply) => {
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const allowedMimes = ["image/png", "image/svg+xml"];
    if (!allowedMimes.includes(file.mimetype)) {
      reply.code(400).send({ error: "Only PNG and SVG files are allowed" });
      return;
    }

    const variant = req.query.variant;
    const ext = file.mimetype === "image/png" ? ".png" : ".svg";
    const maxSize = 2 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        reply.code(400).send({ error: "File size exceeds 2MB limit" });
        return;
      }
      chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);
    reply.send(await service.uploadLogo(data, ext, variant));
  });

  s.delete("/logo", { schema: { querystring: logoVariantQuerySchema } }, async (req, reply) => {
    reply.send(await service.removeLogo(req.query.variant));
  });

  // ── Backup routes ─────────────────────────────

  s.post("/backup", { schema: { body: createBackupBodySchema } }, async (req, reply) => {
    reply.send(await backupService.createBackup(req.body.encrypted));
  });

  s.get("/backups", async (_req, reply) => {
    reply.send(await backupService.listBackups());
  });

  s.get("/backups/:name/download", { schema: { params: backupNameParams } }, async (req, reply) => {
    const { stream } = await backupService.downloadBackup(req.params.name);
    reply.header("Content-Disposition", `attachment; filename="${req.params.name}"`);
    reply.type("application/gzip");
    reply.send(stream);
  });

  s.delete("/backups/:name", { schema: { params: backupNameParams } }, async (req, reply) => {
    await backupService.deleteBackup(req.params.name);
    reply.send({ deleted: true });
  });

  s.post("/restore/:name", { schema: { params: backupNameParams } }, async (req, reply) => {
    const { warnings } = await backupService.restoreFromDisk(req.params.name);
    reply.send({
      ok: true,
      message: "Restore complete. Please log in again.",
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  });

  s.post("/restore", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      reply.code(400).send({ error: "No backup file uploaded" });
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const { warnings } = await backupService.restoreFromUpload({ buffer, filename: file.filename });
    reply.send({
      ok: true,
      message: "Restore complete. Please log in again.",
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  });

  s.get("/backup-settings", async (_req, reply) => {
    reply.send(await backupService.getSettings());
  });

  s.patch("/backup-settings", { schema: { body: backupSettingsBodySchema } }, async (req, reply) => {
    reply.send(await backupService.updateSettings(req.body));
  });

  s.post("/wipe", { schema: { body: wipeDataSchema } }, async (req, reply) => {
    await service.wipeAllData(req.user.sub, req.body.password);
    reply.send({ ok: true, message: "All data wiped. App is now fresh." });
  });
}
