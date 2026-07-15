import type { FastifyInstance } from "fastify";
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
import bcrypt from "bcryptjs";
import { AdminService } from "./admin.service";
import { BackupService } from "./backup.service";
import { prisma } from "../../config/database";

const service = new AdminService();
const backupService = new BackupService();

export async function adminRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("onRequest", app.requireRole("ADMIN"));

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
    const { sendEmail, getConfig } = await import("../../lib/email-service");
    const cfg = await getConfig();
    const subject = cfg?.emailSubject?.replace("{{title}}", "Test") || "Test email";
    const ok = await sendEmail(
      req.body.to || user.email,
      subject,
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
    const MAX_BACKUP_SIZE = 500 * 1024 * 1024; // 500MB
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_BACKUP_SIZE) {
        reply.code(413).send({ error: "Backup file too large (max 500MB)" });
        return;
      }
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

  // ── Module Management ────────────────────────────

  s.get("/modules", async (_req, reply) => {
    const modules = await prisma.userModule.findMany({
      include: { user: { select: { id: true, email: true, username: true, role: true } } },
      orderBy: [{ module: "asc" }, { user: { email: "asc" } }],
    });
    reply.send(modules);
  });

  app.put("/modules/:userId/:module", async (req, reply) => {
    const { userId, module } = req.params as { userId: string; module: string };
    const body = req.body as { enabled: boolean };
    const result = await prisma.userModule.upsert({
      where: { userId_module: { userId, module } },
      update: { enabled: body.enabled },
      create: { userId, module, enabled: body.enabled },
    });
    reply.send(result);
  });

  app.delete("/modules/:userId/:module", async (req, reply) => {
    const { userId, module } = req.params as { userId: string; module: string };
    await prisma.userModule.deleteMany({ where: { userId, module } });
    reply.code(204).send();
  });

  app.post("/users", async (req, reply) => {
    const { email, username, password } = req.body as { email: string; username: string; password: string };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, role: "USER", sedeId: "sede-madrid" },
    });
    reply.code(201).send({ id: user.id, email: user.email, username: user.username, role: user.role });
  });

  // ── Sedes ───────────────────────────────────────

  s.get("/sedes", async (_req, reply) => {
    const sedes = await prisma.sede.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { nombre: "asc" },
    });
    reply.send(sedes);
  });

  s.post("/sedes", async (req, reply) => {
    const { nombre, pais, timezone, festivosIcsUrl } = req.body as any;
    reply.code(201).send(await prisma.sede.create({ data: { nombre, pais, timezone, festivosIcsUrl } }));
  });

  s.patch("/sedes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = req.body as any;
    reply.send(await prisma.sede.update({ where: { id }, data }));
  });

  s.delete("/sedes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.updateMany({ where: { sedeId: id }, data: { sedeId: null } });
    await prisma.sede.delete({ where: { id } });
    reply.code(204).send();
  });

  s.post("/sedes/:id/import-festivos", async (req, reply) => {
    const { id } = req.params as { id: string };
    const sede = await prisma.sede.findUnique({ where: { id } });
    if (!sede || !sede.festivosIcsUrl) throw new Error("Sede sin URL ICS");
    const { FichajeService } = await import("../../modules/fichaje/fichaje.service");
    const service = new FichajeService();
    reply.send(await service.importFestivosFromIcs(sede.festivosIcsUrl, sede.id));
  });

  s.post("/clear-login-attempts/:id", { schema: { params: userIdParams } }, async (req, reply) => {
    reply.send(await service.clearLoginAttempts(req.params.id));
  });

  s.post("/sedes/:id/import-festivos-text", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { icsContent } = req.body as { icsContent: string };
    if (!icsContent) throw new Error("Contenido ICS requerido");
    const sede = await prisma.sede.findUnique({ where: { id } });
    if (!sede) throw new Error("Sede no encontrada");
    const { FichajeService } = await import("../../modules/fichaje/fichaje.service");
    const service = new FichajeService();
    reply.send(await service.importFestivosFromContent(icsContent, sede.id));
  });
}
