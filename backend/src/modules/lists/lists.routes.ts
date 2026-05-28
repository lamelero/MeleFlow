import type { FastifyInstance } from "fastify";
import { createListSchema, updateListSchema } from "./lists.schema";
import { ListService } from "./lists.service";

const service = new ListService();

export async function listRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req, reply) => {
    const lists = await service.findAll(req.user.sub);
    return reply.send(lists);
  });

  app.post("/", async (req, reply) => {
    const input = createListSchema.parse(req.body);
    const list = await service.create(req.user.sub, input);
    return reply.code(201).send(list);
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateListSchema.parse(req.body);
    const list = await service.update(req.user.sub, id, input);
    return reply.send(list);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.code(204).send();
  });
}
