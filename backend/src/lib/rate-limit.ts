import { prisma } from "../config/database";
import { redis } from "../config/redis";
import { env } from "../config/env";

const CACHE_TTL = 60;

async function getCachedSetting(key: string, fallback: number): Promise<number> {
  try {
    const cached = await redis.get(`setting:${key}`);
    if (cached !== null) return Number(cached);
  } catch {
    // redis unavailable, fall through to DB
  }
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  const value = Number(setting?.value) || fallback;
  try {
    await redis.setex(`setting:${key}`, CACHE_TTL, value);
  } catch {
    // non-critical
  }
  return value;
}

export async function checkRateLimit(email: string, ip: string): Promise<{
  blocked: boolean;
  remainingAttempts: number;
  lockoutMinutes: number;
}> {
  const maxAttempts = await getCachedSetting("maxLoginAttempts", env.MAX_LOGIN_ATTEMPTS);
  const lockoutMinutes = await getCachedSetting("loginLockoutMinutes", env.LOGIN_LOCKOUT_MINUTES);

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
