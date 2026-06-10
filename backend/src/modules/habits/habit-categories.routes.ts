import { FastifyInstance } from "fastify";
import { HabitCategoryService } from "./habit-categories.service";
import { createCategorySchema, updateCategorySchema } from "./habit-categories.schema";

export async function habitCategoryRoutes(app: FastifyInstance) {
  const service = new HabitCategoryService();

  app.get("/habit-categories", { onRequest: [app.authenticate] }, async (req, reply) => {
    const categories = await service.findAll(req.user.sub);
    return reply.send(categories);
  });

  app.post("/habit-categories", { onRequest: [app.authenticate] }, async (req, reply) => {
    const input = createCategorySchema.parse(req.body);
    const category = await service.create(req.user.sub, input);
    return reply.status(201).send(category);
  });

  app.patch("/habit-categories/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateCategorySchema.parse(req.body);
    const category = await service.update(req.user.sub, id, input);
    return reply.send(category);
  });

  app.delete("/habit-categories/:id", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.status(204).send();
  });
}
