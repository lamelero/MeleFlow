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
    };
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

    return this.getSettings();
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
