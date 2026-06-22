import { prisma } from "../../config/database";
import createError from "http-errors";

export class NotificationService {
  async registerToken(userId: string, token: string, platform = "android") {
    const existing = await prisma.deviceToken.findUnique({ where: { token } });
    if (existing) {
      if (existing.userId !== userId) {
        throw createError.Conflict("Token already registered to another user");
      }
      return existing;
    }
    return prisma.deviceToken.create({
      data: { userId, token, platform },
    });
  }

  async unregisterToken(userId: string, token: string) {
    await prisma.deviceToken.deleteMany({ where: { token, userId } });
  }

  async getTokens(userId: string) {
    return prisma.deviceToken.findMany({ where: { userId } });
  }

  async getAllTokens(): Promise<string[]> {
    const tokens = await prisma.deviceToken.findMany({ select: { token: true } });
    return tokens.map((t) => t.token);
  }
}
