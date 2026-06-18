import type { FastifyInstance } from "fastify";
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskTagSchema,
  addCollaboratorSchema,
} from "./tasks.schema";
import { TaskService } from "./tasks.service";
import { AttachmentService } from "./attachment.service";

const service = new TaskService();
const attachmentService = new AttachmentService();

export async function taskRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req, reply) => {
    const query = taskQuerySchema.parse(req.query);
    const tasks = await service.findAll(req.user.sub, query);
    return reply.send(tasks);
  });

  app.get("/shared", async (req, reply) => {
    const tasks = await service.findShared(req.user.sub);
    return reply.send(tasks);
  });

  app.get("/search", async (req, reply) => {
    const { q } = req.query as { q: string };
    if (!q || q.length < 2) return reply.send([]);
    const tasks = await service.search(req.user.sub, q);
    return reply.send(tasks);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await service.findById(req.user.sub, id);
    return reply.send(task);
  });

  app.post("/", async (req, reply) => {
    const input = createTaskSchema.parse(req.body);
    const task = await service.create(req.user.sub, input);
    return reply.code(201).send(task);
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateTaskSchema.parse(req.body);
    const task = await service.update(req.user.sub, id, input);
    return reply.send(task);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.code(204).send();
  });

  app.post("/:id/tags", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tagId } = taskTagSchema.parse(req.body);
    const task = await service.addTag(req.user.sub, id, tagId);
    return reply.send(task);
  });

  app.delete("/:id/tags/:tagId", async (req, reply) => {
    const { id, tagId } = req.params as { id: string; tagId: string };
    const task = await service.removeTag(req.user.sub, id, tagId);
    return reply.send(task);
  });

  // ── Collaborator routes ──────────────────────

  app.get("/:id/collaborators", async (req, reply) => {
    const { id } = req.params as { id: string };
    const collaborators = await service.getCollaborators(req.user.sub, id);
    return reply.send(collaborators);
  });

  app.post("/:id/collaborators", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = addCollaboratorSchema.parse(req.body);
    const task = await service.addCollaborator(req.user.sub, id, input);
    return reply.send(task);
  });

  app.delete("/:id/collaborators/:collaboratorId", async (req, reply) => {
    const { id, collaboratorId } = req.params as { id: string; collaboratorId: string };
    const task = await service.removeCollaborator(req.user.sub, id, collaboratorId);
    return reply.send(task);
  });

  // ── Attachment routes ────────────────────────

  app.get("/:id/attachments", async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachments = await attachmentService.findByTask(req.user.sub, id);
    return reply.send(attachments);
  });

  app.post("/:id/attachments", async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = await req.file();

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const buffer = await data.toBuffer();
    const attachment = await attachmentService.upload(req.user.sub, id, {
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    });

    return reply.code(201).send(attachment);
  });

  app.delete("/:id/attachments/:attachmentId", async (req, reply) => {
    const { id, attachmentId } = req.params as { id: string; attachmentId: string };
    await attachmentService.delete(req.user.sub, id, attachmentId);
    return reply.code(204).send();
  });
}
