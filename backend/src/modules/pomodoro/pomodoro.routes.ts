import type { FastifyInstance } from "fastify";
import { startSessionSchema } from "./pomodoro.schema";
import { PomodoroService } from "./pomodoro.service";

const service = new PomodoroService();

export async function pomodoroRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/current", async (req, reply) => {
    const session = await service.getCurrent(req.user.sub);
    return reply.send(session ?? null);
  });

  app.post("/start", async (req, reply) => {
    const input = startSessionSchema.parse(req.body);
    const session = await service.start(req.user.sub, input);
    return reply.code(201).send(session);
  });

  app.post("/:id/pause", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await service.pause(req.user.sub, id);
    return reply.send(session);
  });

  app.post("/:id/resume", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await service.resume(req.user.sub, id);
    return reply.send(session);
  });

  app.post("/:id/complete", async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await service.complete(req.user.sub, id);
    return reply.send(session);
  });
}
