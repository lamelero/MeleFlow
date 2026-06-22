import { prisma } from "../../config/database";
import { env } from "../../config/env";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";

export async function settingsRoutes(app: FastifyInstance) {
  const s = app.withTypeProvider<ZodTypeProvider>();

  s.get("/settings/logo", async (_req, reply) => {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["logoUrl", "logoUrlDark"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    reply.send({
      logoUrl: map.logoUrl || null,
      logoUrlDark: map.logoUrlDark || null,
    });
  });

  s.get("/settings/registration-status", async (_req, reply) => {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "allowRegistration" },
    });
    reply.send({
      allowRegistration: setting
        ? setting.value === "true"
        : env.ALLOW_REGISTRATION,
    });
  });
}
