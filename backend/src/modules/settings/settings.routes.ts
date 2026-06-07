import { prisma } from "../../config/database";
import { env } from "../../config/env";
import type { FastifyInstance } from "fastify";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/logo", async (_req, reply) => {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["logoUrl", "logoUrlDark"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return reply.send({
      logoUrl: map.logoUrl || null,
      logoUrlDark: map.logoUrlDark || null,
    });
  });

  app.get("/settings/registration-status", async () => {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "allowRegistration" },
    });
    return {
      allowRegistration: setting
        ? setting.value === "true"
        : env.ALLOW_REGISTRATION,
    };
  });
}
