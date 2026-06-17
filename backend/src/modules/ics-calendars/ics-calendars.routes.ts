import type { FastifyInstance } from "fastify";
import { IcsCalendarService } from "./ics-calendars.service";
import {
  createIcsCalendarSchema,
  updateIcsCalendarSchema,
  eventsQuerySchema,
} from "./ics-calendars.schema";

const service = new IcsCalendarService();

export async function icsCalendarRoutes(app: FastifyInstance) {
  // List user's ICS calendars
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const calendars = await service.findAll(req.user!.sub);
      return reply.send(calendars);
    },
  );

  // Add new ICS calendar feed
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const input = createIcsCalendarSchema.parse(req.body);
      const calendar = await service.create(req.user!.sub, input);
      return reply.code(201).send(calendar);
    },
  );

  // Delete ICS calendar feed
  app.delete(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      await service.remove(req.user!.sub, id);
      return reply.code(204).send();
    },
  );

  // Update ICS calendar feed (notification prefs, name, color)
  app.patch(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const input = updateIcsCalendarSchema.parse(req.body);
      const calendar = await service.update(req.user!.sub, id, input);
      return reply.send(calendar);
    },
  );

  // Manually sync a calendar
  app.post(
    "/:id/sync",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const result = await service.sync(req.user!.sub, id);
      return reply.send(result);
    },
  );

  // Get events for a date range
  app.get(
    "/events",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const query = eventsQuerySchema.parse(req.query);
      const events = await service.getEvents(
        req.user!.sub,
        query.from,
        query.to,
      );
      return reply.send(events);
    },
  );
}
