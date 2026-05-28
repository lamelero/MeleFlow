import type { FastifyInstance } from "fastify";
import { createHabitSchema } from "./habits.schema";
import { HabitService } from "./habits.service";

const service = new HabitService();

export async function habitRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req, reply) => {
    const habits = await service.findAll(req.user.sub);
    return reply.send(habits);
  });

  app.post("/", async (req, reply) => {
    const input = createHabitSchema.parse(req.body);
    const habit = await service.create(req.user.sub, input);
    return reply.code(201).send(habit);
  });

  app.post("/:id/check", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await service.checkIn(req.user.sub, id);
    return reply.send(result);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.code(204).send();
  });
}
