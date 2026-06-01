import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { updateUserSchema, updateSettingsSchema } from "./admin.schema";
import { AdminService } from "./admin.service";

const service = new AdminService();

async function isAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    if (req.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", isAdmin);

  app.get("/users", async (_req, reply) => {
    const users = await service.getUsers();
    return reply.send(users);
  });

  app.put("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const input = updateUserSchema.parse(req.body);
    const result = await service.updateUser(req.user.sub, id, input);
    return reply.send(result);
  });

  app.get("/stats", async (_req, reply) => {
    const stats = await service.getStats();
    return reply.send(stats);
  });

  app.get("/settings", async (_req, reply) => {
    const settings = await service.getSettings();
    return reply.send(settings);
  });

  app.patch("/settings", async (req, reply) => {
    const input = updateSettingsSchema.parse(req.body);
    const settings = await service.updateSettings(input);
    return reply.send(settings);
  });
}
