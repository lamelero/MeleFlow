import { prisma } from "../../config/database";
import type { FastifyInstance } from "fastify";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/logo", async (_req, reply) => {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "logoUrl" },
    });
    return reply.send({ logoUrl: row?.value || null });
  });
}
