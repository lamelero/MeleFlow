import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { createTagSchema, updateTagSchema, tagIdParams } from "./tags.schema";
import { TagService } from "./tags.service";

const service = new TagService();

export async function tagRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/", async (req, reply) => {
    reply.send(await service.findAll(req.user.sub));
  });

  s.post("/", { schema: { body: createTagSchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.patch("/:id", {
    schema: { body: updateTagSchema, params: tagIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.delete("/:id", { schema: { params: tagIdParams } }, async (req, reply) => {
    await service.delete(req.user.sub, req.params.id);
    reply.code(204).send();
  });
}
