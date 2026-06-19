import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { createListSchema, updateListSchema, listIdParams } from "./lists.schema";
import { ListService } from "./lists.service";

const service = new ListService();

export async function listRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/", async (req, reply) => {
    reply.send(await service.findAll(req.user.sub));
  });

  s.post("/", { schema: { body: createListSchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.patch("/:id", {
    schema: { body: updateListSchema, params: listIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.delete("/:id", { schema: { params: listIdParams } }, async (req, reply) => {
    await service.delete(req.user.sub, req.params.id);
    reply.code(204).send();
  });
}
