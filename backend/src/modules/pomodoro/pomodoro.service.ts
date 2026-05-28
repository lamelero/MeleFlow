import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { StartSessionInput } from "./pomodoro.schema";

export class PomodoroService {
  async getCurrent(userId: string) {
    const session = await prisma.pomodoroSession.findFirst({
      where: { userId, state: { in: ["RUNNING", "PAUSED"] } },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startedAt: "desc" },
    });

    return session;
  }

  async start(userId: string, input: StartSessionInput) {
    // Complete any existing running/paused sessions
    await prisma.pomodoroSession.updateMany({
      where: { userId, state: { in: ["RUNNING", "PAUSED"] } },
      data: { state: "CANCELLED" },
    });

    const session = await prisma.pomodoroSession.create({
      data: {
        userId,
        duration: input.duration,
        state: "RUNNING",
        startedAt: new Date(),
        taskId: input.taskId ?? null,
      },
    });

    return session;
  }

  async pause(userId: string, sessionId: string) {
    const session = await prisma.pomodoroSession.findFirst({
      where: { id: sessionId, userId, state: "RUNNING" },
    });

    if (!session) {
      throw new AppError(404, "No running session found");
    }

    return prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: { state: "PAUSED", pausedAt: new Date() },
    });
  }

  async resume(userId: string, sessionId: string) {
    const session = await prisma.pomodoroSession.findFirst({
      where: { id: sessionId, userId, state: "PAUSED" },
    });

    if (!session) {
      throw new AppError(404, "No paused session found");
    }

    return prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: { state: "RUNNING", pausedAt: null },
    });
  }

  async complete(userId: string, sessionId: string) {
    const session = await prisma.pomodoroSession.findFirst({
      where: { id: sessionId, userId, state: { in: ["RUNNING", "PAUSED"] } },
    });

    if (!session) {
      throw new AppError(404, "No active session found");
    }

    const completed = await prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: { state: "COMPLETED", completedAt: new Date() },
    });

    return completed;
  }
}
