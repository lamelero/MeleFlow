import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import { startSessionSchema, updateSettingsSchema } from "./pomodoro.schema";
import { PomodoroService } from "./pomodoro.service";

const pomodoroIdParams = z.object({ id: z.string() });
const service = new PomodoroService();

export async function pomodoroRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/current", async (req, reply) => {
    reply.send(await service.getCurrent(req.user.sub) ?? null);
  });

  s.post("/start", { schema: { body: startSessionSchema } }, async (req, reply) => {
    reply.code(201).send(await service.start(req.user.sub, req.body));
  });

  s.post("/:id/pause", { schema: { params: pomodoroIdParams } }, async (req, reply) => {
    reply.send(await service.pause(req.user.sub, req.params.id));
  });

  s.post("/:id/resume", { schema: { params: pomodoroIdParams } }, async (req, reply) => {
    reply.send(await service.resume(req.user.sub, req.params.id));
  });

  s.post("/:id/complete", { schema: { params: pomodoroIdParams } }, async (req, reply) => {
    reply.send(await service.complete(req.user.sub, req.params.id));
  });

  s.post("/:id/cancel", { schema: { params: pomodoroIdParams } }, async (req, reply) => {
    reply.send(await service.cancel(req.user.sub, req.params.id));
  });

  s.get("/settings", async (req, reply) => {
    reply.send(await service.getSettings(req.user.sub));
  });

  s.put("/settings", { schema: { body: updateSettingsSchema } }, async (req, reply) => {
    reply.send(await service.updateSettings(req.user.sub, req.body));
  });

  s.get("/stats", async (req, reply) => {
    reply.send(await service.getStats(req.user.sub));
  });
}
