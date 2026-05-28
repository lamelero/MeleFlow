import type { FastifyInstance } from "fastify";
import { createTagSchema, updateTagSchema } from "./tags.schema";
import { TagService } from "./tags.service";

const service = new TagService();

export async function tagRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req, reply) => {
    const tags = await service.findAll(req.user.sub);
    return reply.send(tags);
  });

  app.post("/", async (req, reply) => {
    const input = createTagSchema.parse(req.body);
    const tag = await service.create(req.user.sub, input);
    return reply.code(201).send(tag);
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateTagSchema.parse(req.body);
    const tag = await service.update(req.user.sub, id, input);
    return reply.send(tag);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.code(204).send();
  });
}
