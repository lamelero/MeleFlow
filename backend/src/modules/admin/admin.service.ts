import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { UpdateUserInput } from "./admin.schema";

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
