import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { HabitCategoryService } from "./habit-categories.service";
import { createCategorySchema, updateCategorySchema, categoryIdParams } from "./habit-categories.schema";

export async function habitCategoryRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  const service = new HabitCategoryService();

  s.get("/habit-categories", async (req, reply) => {
    reply.send(await service.findAll(req.user.sub));
  });

  s.post("/habit-categories", { schema: { body: createCategorySchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.patch("/habit-categories/:id", {
    schema: { body: updateCategorySchema, params: categoryIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.delete("/habit-categories/:id", { schema: { params: categoryIdParams } }, async (req, reply) => {
    await service.delete(req.user.sub, req.params.id);
    reply.code(204).send();
  });
}
