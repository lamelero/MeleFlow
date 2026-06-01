import { prisma } from "../config/database";
import { env } from "../config/env";

export async function checkRateLimit(email: string, ip: string): Promise<{
  blocked: boolean;
  remainingAttempts: number;
  lockoutMinutes: number;
}> {
  const maxAttempts =
    Number(
      (
        await prisma.systemSetting.findUnique({
          where: { key: "maxLoginAttempts" },
        })
      )?.value,
    ) || env.MAX_LOGIN_ATTEMPTS;

  const lockoutMinutes =
    Number(
      (
        await prisma.systemSetting.findUnique({
          where: { key: "loginLockoutMinutes" },
        })
      )?.value,
    ) || env.LOGIN_LOCKOUT_MINUTES;

  const since = new Date(Date.now() - lockoutMinutes * 60 * 1000);

  const [emailAttempts, ipAttempts] = await Promise.all([
    prisma.failedLoginAttempt.count({
      where: { email, createdAt: { gte: since } },
    }),
    prisma.failedLoginAttempt.count({
      where: { ip, createdAt: { gte: since } },
    }),
  ]);

  const total = Math.max(emailAttempts, ipAttempts);
  const blocked = total >= maxAttempts;
  const remainingAttempts = Math.max(0, maxAttempts - total);

  return { blocked, remainingAttempts, lockoutMinutes };
}

export async function recordFailedAttempt(
  email: string,
  ip: string,
  userAgent?: string,
): Promise<void> {
  await prisma.failedLoginAttempt.create({
    data: { email, ip, userAgent },
  });
}

export async function clearFailedAttempts(email: string, ip: string): Promise<void> {
  await prisma.failedLoginAttempt.deleteMany({
    where: { OR: [{ email }, { ip }] },
  });
}
