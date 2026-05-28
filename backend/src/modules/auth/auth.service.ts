import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import type { RegisterInput, LoginInput } from "./auth.schema";

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
    });

    if (existing) {
      const field = existing.email === input.email ? "email" : "username";
      throw new AppError(409, `${field} already taken`);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
      },
    });

    return this.buildTokens(user.id, user.role);
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new AppError(401, "Invalid credentials");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid credentials");
    }

    return this.buildTokens(user.id, user.role);
  }

  async refresh(refreshToken: string) {
    const stored = await redis.get(`refresh:${refreshToken}`);
    if (!stored) {
      throw new AppError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: stored } });
    if (!user) {
      await redis.del(`refresh:${refreshToken}`);
      throw new AppError(401, "User not found");
    }

    // Rotate refresh token
    await redis.del(`refresh:${refreshToken}`);
    return this.buildTokens(user.id, user.role);
  }

  async logout(refreshToken: string) {
    await redis.del(`refresh:${refreshToken}`);
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, role: true, language: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return user;
  }

  async updateLanguage(userId: string, language: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { language },
    });
  }

  private async buildTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { sub: userId, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );

    const refreshToken = crypto.randomBytes(48).toString("hex");

    const ttlSeconds = this.parseExpiry(env.JWT_REFRESH_EXPIRES_IN);
    await redis.set(`refresh:${refreshToken}`, userId, "EX", ttlSeconds);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, role: true },
    });

    return { accessToken, refreshToken, user };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 86400; // default 7 days
    const value = Number.parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] || 86400);
  }
}
