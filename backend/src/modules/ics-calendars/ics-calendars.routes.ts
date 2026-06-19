import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { IcsCalendarService } from "./ics-calendars.service";
import {
  createIcsCalendarSchema,
  updateIcsCalendarSchema,
  eventsQuerySchema,
  icsCalendarIdParams,
  searchQuerySchema,
} from "./ics-calendars.schema";

const service = new IcsCalendarService();

export async function icsCalendarRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  s.get("/", async (req, reply) => {
    reply.send(await service.findAll(req.user.sub));
  });

  s.post("/", { schema: { body: createIcsCalendarSchema } }, async (req, reply) => {
    reply.code(201).send(await service.create(req.user.sub, req.body));
  });

  s.delete("/:id", { schema: { params: icsCalendarIdParams } }, async (req, reply) => {
    await service.remove(req.user.sub, req.params.id);
    reply.code(204).send();
  });

  s.patch("/:id", {
    schema: { body: updateIcsCalendarSchema, params: icsCalendarIdParams },
  }, async (req, reply) => {
    reply.send(await service.update(req.user.sub, req.params.id, req.body));
  });

  s.post("/:id/sync", { schema: { params: icsCalendarIdParams } }, async (req, reply) => {
    reply.send(await service.sync(req.user.sub, req.params.id));
  });

  s.get("/events", { schema: { querystring: eventsQuerySchema } }, async (req, reply) => {
    reply.send(await service.getEvents(req.user.sub, req.query.from, req.query.to));
  });

  s.get("/search", { schema: { querystring: searchQuerySchema } }, async (req, reply) => {
    if (!req.query.q || req.query.q.length < 2) {
      reply.send([]);
      return;
    }
    reply.send(await service.searchEvents(req.user.sub, req.query.q));
  });
}
