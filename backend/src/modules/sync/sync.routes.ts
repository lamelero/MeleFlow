import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { pullQuerySchema, pushBodySchema } from "./sync.schema";
import { SyncService } from "./sync.service";
import { PULL_RATE_LIMIT, PUSH_RATE_LIMIT } from "./sync.constants";

const service = new SyncService();

export async function syncRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();
  s.addHook("onRequest", app.authenticate);

  // Incremental pull. Without a cursor it returns a full snapshot of active
  // rows; with a cursor it returns every row (including tombstones) whose
  // version is greater than the cursor.
  s.get(
    "/pull",
    {
      schema: { querystring: pullQuerySchema },
      config: { rateLimit: PULL_RATE_LIMIT },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.send(await service.pull(req.user.sub, req.query.cursor, req.query.deviceId));
    },
  );

  // Batched offline mutations. Each operation is idempotent by operationId.
  s.post(
    "/push",
    {
      schema: { body: pushBodySchema },
      config: { rateLimit: PUSH_RATE_LIMIT },
      bodyLimit: 2 * 1024 * 1024,
    },
    async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.send(await service.push(req.user.sub, req.body));
    },
  );
}
