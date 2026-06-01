import type { FastifyInstance } from "fastify";
import {
  createHabitSchema,
  updateHabitSchema,
  progressQuerySchema,
} from "./habits.schema";
import { HabitService } from "./habits.service";

const service = new HabitService();

export async function habitRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req, reply) => {
    const query = req.query as { archived?: string };
    const habits = await service.findAll(
      req.user.sub,
      query.archived === "true",
    );
    return reply.send(habits);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const habit = await service.findById(req.user.sub, id);
    return reply.send(habit);
  });

  app.post("/", async (req, reply) => {
    const input = createHabitSchema.parse(req.body);
    const habit = await service.create(req.user.sub, input);
    return reply.code(201).send(habit);
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateHabitSchema.parse(req.body);
    const habit = await service.update(req.user.sub, id, input);
    return reply.send(habit);
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await service.delete(req.user.sub, id);
    return reply.code(204).send();
  });

  app.post("/:id/progress", async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = progressQuerySchema.parse(req.query);
    const result = await service.checkIn(req.user.sub, id, query.date);
    return reply.send(result);
  });

  app.delete("/:id/progress", async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = progressQuerySchema.parse(req.query);
    const result = await service.undoCheckIn(req.user.sub, id, query.date);
    return reply.send(result);
  });

  app.post("/:id/reset", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await service.resetProgress(req.user.sub, id);
    return reply.send(result);
  });
}
