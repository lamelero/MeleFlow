import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  createHabitSchema,
  updateHabitSchema,
  progressQuerySchema,
  habitIdParams,
  habitQuerySchema,
} from "./habits.schema";
import { HabitService } from "./habits.service";

const service = new HabitService();

export async function habitRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/", { schema: { querystring: habitQuerySchema } }, async (req, reply) => {
    reply.send(await service.findAll(req.user.sub, req.query.archived === "true"));
  });

  s.get("/:id", { schema: { params: habitIdParams } }, async (req, reply) => {
    reply.send(await service.findById(req.user.sub, req.params.id));
  });

  s.post("/", { schema: { body: createHabitSchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.patch("/:id", {
    schema: { body: updateHabitSchema, params: habitIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.delete("/:id", { schema: { params: habitIdParams } }, async (req, reply) => {
    await service.delete(req.user.sub, req.params.id);
    reply.code(204).send();
  });

  s.post("/:id/progress", {
    schema: { params: habitIdParams, querystring: progressQuerySchema },
  }, async (req, reply) => {
    reply.send(await service.checkIn(req.user.sub, req.params.id, req.query.date, req.query.status));
  });

  s.delete("/:id/progress", {
    schema: { params: habitIdParams, querystring: progressQuerySchema },
  }, async (req, reply) => {
    reply.send(await service.undoCheckIn(req.user.sub, req.params.id, req.query.date));
  });

  s.post("/:id/reset", { schema: { params: habitIdParams } }, async (req, reply) => {
    reply.send(await service.resetProgress(req.user.sub, req.params.id));
  });
}
