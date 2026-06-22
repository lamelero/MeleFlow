import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskTagSchema,
  addCollaboratorSchema,
  taskIdParams,
  taskIdTagIdParams,
  taskIdCollabIdParams,
  taskIdAttachmentIdParams,
  searchQuerySchema,
} from "./tasks.schema";
import { TaskService } from "./tasks.service";
import { AttachmentService } from "./attachment.service";

const service = new TaskService();
const attachmentService = new AttachmentService();

export async function taskRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/", { schema: { querystring: taskQuerySchema } }, async (req, reply) => {
    reply.send(await service.findAll(req.user.sub, req.query));
  });

  s.get("/shared", async (req, reply) => {
    reply.send(await service.findShared(req.user.sub));
  });

  s.get("/search", { schema: { querystring: searchQuerySchema } }, async (req, reply) => {
    if (!req.query.q || req.query.q.length < 2) {
      reply.send([]);
      return;
    }
    reply.send(await service.search(req.user.sub, req.query.q));
  });

  s.get("/:id", { schema: { params: taskIdParams } }, async (req, reply) => {
    reply.send(await service.findById(req.user.sub, req.params.id));
  });

  s.post("/", { schema: { body: createTaskSchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.patch("/:id", {
    schema: { body: updateTaskSchema, params: taskIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.delete("/:id", { schema: { params: taskIdParams } }, async (req, reply) => {
    await service.delete(req.user.sub, req.params.id);
    reply.code(204).send();
  });

  s.post("/:id/tags", {
    schema: { body: taskTagSchema, params: taskIdParams },
  }, async (req, reply) => {
    reply.send(await service.addTag(req.user.sub, req.params.id, req.body.tagId));
  });

  s.delete("/:id/tags/:tagId", {
    schema: { params: taskIdTagIdParams },
  }, async (req, reply) => {
    reply.send(await service.removeTag(req.user.sub, req.params.id, req.params.tagId));
  });

  // ── Collaborator routes ──────────────────────

  s.get("/:id/collaborators", { schema: { params: taskIdParams } }, async (req, reply) => {
    reply.send(await service.getCollaborators(req.user.sub, req.params.id));
  });

  s.post("/:id/collaborators", {
    schema: { body: addCollaboratorSchema, params: taskIdParams },
  }, async (req, reply) => {
    reply.send(await service.addCollaborator(req.user.sub, req.params.id, req.body));
  });

  s.delete("/:id/collaborators/:collaboratorId", {
    schema: { params: taskIdCollabIdParams },
  }, async (req, reply) => {
    reply.send(await service.removeCollaborator(req.user.sub, req.params.id, req.params.collaboratorId));
  });

  // ── Attachment routes ────────────────────────

  s.get("/:id/attachments", { schema: { params: taskIdParams } }, async (req, reply) => {
    reply.send(await attachmentService.findByTask(req.user.sub, req.params.id));
  });

  s.post("/:id/attachments", { schema: { params: taskIdParams } }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }
    const buffer = await data.toBuffer();
    reply.code(201).send(await attachmentService.upload(req.user.sub, req.params.id, {
      filename: data.filename,
      buffer,
      mimetype: data.mimetype,
    }));
  });

  s.delete("/:id/attachments/:attachmentId", {
    schema: { params: taskIdAttachmentIdParams },
  }, async (req, reply) => {
    await attachmentService.delete(req.user.sub, req.params.id, req.params.attachmentId);
    reply.code(204).send();
  });
}
