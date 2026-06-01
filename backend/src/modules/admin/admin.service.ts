import path from "path";
import fs from "fs/promises";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";
import type { UpdateUserInput, UpdateSettingsInput } from "./admin.schema";

export class AdminService {
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { tasks: true, lists: true, habits: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateUser(currentUserId: string, targetUserId: string, input: UpdateUserInput) {
    if (currentUserId === targetUserId && input.role !== undefined) {
      throw new AppError(400, "Cannot change your own role");
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
      },
    });
  }

  async getSettings() {
    const rows = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      allowRegistration: map.allowRegistration !== undefined
        ? map.allowRegistration === "true"
        : env.ALLOW_REGISTRATION,
      maxUploadSize: map.maxUploadSize !== undefined
        ? Number(map.maxUploadSize)
        : env.MAX_UPLOAD_SIZE,
      maxLoginAttempts: map.maxLoginAttempts !== undefined
        ? Number(map.maxLoginAttempts)
        : env.MAX_LOGIN_ATTEMPTS,
      loginLockoutMinutes: map.loginLockoutMinutes !== undefined
        ? Number(map.loginLockoutMinutes)
        : env.LOGIN_LOCKOUT_MINUTES,
      smtpHost: map.smtpHost || "",
      smtpPort: map.smtpPort ? Number(map.smtpPort) : 587,
      smtpUser: map.smtpUser || "",
      smtpPassword: map.smtpPassword ? "••••••••" : "",
      fromEmail: map.fromEmail || "",
      emailEnabled: map.emailEnabled === "true",
      emailSubject: map.emailSubject || "Reminder: {{title}} is due soon",
      logoUrl: map.logoUrl || "",
    };
  }

  async uploadLogo(data: Buffer, ext: string) {
    const filename = `logo-${Date.now()}${ext}`;
    const uploadDir = path.resolve("uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Remove old logo files
    const existing = (await fs.readdir(uploadDir).catch(() => []))
      .filter((f) => f.startsWith("logo-"));
    await Promise.all(existing.map((f) => fs.unlink(path.join(uploadDir, f)).catch(() => {})));

    await fs.writeFile(path.join(uploadDir, filename), data);

    const logoUrl = `/uploads/${filename}`;
    await prisma.systemSetting.upsert({
      where: { key: "logoUrl" },
      create: { key: "logoUrl", value: logoUrl },
      update: { value: logoUrl },
    });

    return { logoUrl };
  }

  async removeLogo() {
    const uploadDir = path.resolve("uploads");
    const existing = (await fs.readdir(uploadDir).catch(() => []))
      .filter((f) => f.startsWith("logo-"));
    await Promise.all(existing.map((f) => fs.unlink(path.join(uploadDir, f)).catch(() => {})));

    await prisma.systemSetting.upsert({
      where: { key: "logoUrl" },
      create: { key: "logoUrl", value: "" },
      update: { value: "" },
    });

    return { logoUrl: null };
  }

  async updateSettings(input: UpdateSettingsInput) {
    const upsert = async (key: string, value: string) => {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    };

    if (input.allowRegistration !== undefined) {
      await upsert("allowRegistration", String(input.allowRegistration));
    }
    if (input.maxUploadSize !== undefined) {
      await upsert("maxUploadSize", String(input.maxUploadSize));
    }
    if (input.maxLoginAttempts !== undefined) {
      await upsert("maxLoginAttempts", String(input.maxLoginAttempts));
    }
    if (input.loginLockoutMinutes !== undefined) {
      await upsert("loginLockoutMinutes", String(input.loginLockoutMinutes));
    }
    if (input.smtpHost !== undefined) {
      await upsert("smtpHost", input.smtpHost);
    }
    if (input.smtpPort !== undefined) {
      await upsert("smtpPort", String(input.smtpPort));
    }
    if (input.smtpUser !== undefined) {
      await upsert("smtpUser", input.smtpUser);
    }
    if (input.smtpPassword !== undefined && input.smtpPassword !== "••••••••") {
      await upsert("smtpPassword", input.smtpPassword);
    }
    if (input.fromEmail !== undefined) {
      await upsert("fromEmail", input.fromEmail);
    }
    if (input.emailEnabled !== undefined) {
      await upsert("emailEnabled", String(input.emailEnabled));
    }
    if (input.emailSubject !== undefined) {
      await upsert("emailSubject", input.emailSubject);
    }

    return this.getSettings();
  }

  async getSecurityLogs(limit: number, offset: number) {
    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, username: true } },
        },
      }),
      prisma.securityLog.count(),
    ]);

    return { logs, total, limit, offset };
  }

  async getStats() {
    const [
      totalUsers,
      totalTasks,
      completedTasks,
      totalLists,
      totalHabits,
      totalPomodoros,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.task.count({ where: { isCompleted: true } }),
      prisma.list.count(),
      prisma.habit.count(),
      prisma.pomodoroSession.count({ where: { state: "COMPLETED" } }),
    ]);

    return {
      totalUsers,
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalLists,
      totalHabits,
      totalPomodoros,
    };
  }
}
