import { prisma } from "../config/database";

export async function logSecurityEvent(params: {
  userId?: string;
  action: string;
  details?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.securityLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      details: params.details ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}
