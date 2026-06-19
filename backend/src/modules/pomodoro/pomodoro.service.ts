import { prisma } from "../../config/database";
import createError from "http-errors";
import type { StartSessionInput, UpdateSettingsInput } from "./pomodoro.schema";

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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pomodoroWork: true,
        pomodoroShortBreak: true,
        pomodoroLongBreak: true,
        pomodoroCycles: true,
      },
    });
    if (!user) throw createError.NotFound( "User not found");

    const type = input.type ?? "FOCUS";
    let duration = input.duration;

    if (!duration) {
      duration =
        type === "FOCUS"
          ? user.pomodoroWork
          : type === "SHORT_BREAK"
            ? user.pomodoroShortBreak
            : user.pomodoroLongBreak;
    }

    // Cancel any existing running/paused sessions
    await prisma.pomodoroSession.updateMany({
      where: { userId, state: { in: ["RUNNING", "PAUSED"] } },
      data: { state: "CANCELLED" },
    });

    const session = await prisma.pomodoroSession.create({
      data: {
        userId,
        type,
        duration,
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
      throw createError.NotFound( "No running session found");
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
      throw createError.NotFound( "No paused session found");
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
      throw createError.NotFound( "No active session found");
    }

    const completed = await prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: { state: "COMPLETED", completedAt: new Date() },
    });

    return completed;
  }

  async cancel(userId: string, sessionId: string) {
    const session = await prisma.pomodoroSession.findFirst({
      where: { id: sessionId, userId, state: { in: ["RUNNING", "PAUSED"] } },
    });

    if (!session) {
      throw createError.NotFound( "No active session found");
    }

    return prisma.pomodoroSession.update({
      where: { id: sessionId },
      data: { state: "CANCELLED" },
    });
  }

  async getSettings(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pomodoroWork: true,
        pomodoroShortBreak: true,
        pomodoroLongBreak: true,
        pomodoroCycles: true,
      },
    });
    if (!user) throw createError.NotFound( "User not found");

    return {
      work: user.pomodoroWork,
      shortBreak: user.pomodoroShortBreak,
      longBreak: user.pomodoroLongBreak,
      cycles: user.pomodoroCycles,
    };
  }

  async updateSettings(userId: string, input: UpdateSettingsInput) {
    const data: Record<string, number> = {};
    if (input.pomodoroWork !== undefined) data.pomodoroWork = input.pomodoroWork;
    if (input.pomodoroShortBreak !== undefined) data.pomodoroShortBreak = input.pomodoroShortBreak;
    if (input.pomodoroLongBreak !== undefined) data.pomodoroLongBreak = input.pomodoroLongBreak;
    if (input.pomodoroCycles !== undefined) data.pomodoroCycles = input.pomodoroCycles;

    await prisma.user.update({ where: { id: userId }, data });

    return this.getSettings(userId);
  }

  async getStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pomodoroCycles: true },
    });
    if (!user) throw createError.NotFound( "User not found");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const focusCompleted = await prisma.pomodoroSession.count({
      where: {
        userId,
        type: "FOCUS",
        state: "COMPLETED",
        completedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const cycles = user.pomodoroCycles;

    const lastSession = await prisma.pomodoroSession.findFirst({
      where: {
        userId,
        state: "COMPLETED",
        completedAt: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { completedAt: "desc" },
    });

    let nextPhase: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
    if (!lastSession) {
      nextPhase = "FOCUS";
    } else if (lastSession.type === "FOCUS") {
      nextPhase = focusCompleted % cycles === 0 ? "LONG_BREAK" : "SHORT_BREAK";
    } else {
      nextPhase = "FOCUS";
    }

    return {
      completedToday: focusCompleted,
      focusCompleted,
      nextPhase,
      cycles,
    };
  }
}
