import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateHabitInput, UpdateHabitInput } from "./habits.schema";

function normalizeDate(d: Date): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates
    .map(normalizeDate)
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = normalizeDate(new Date());
  let streak = 0;
  let expected = today;

  for (const date of sorted) {
    if (date.getTime() === expected.getTime()) {
      streak++;
      expected = new Date(expected.getTime() - 86400000);
    } else if (date.getTime() < expected.getTime()) {
      break;
    }
  }
  return streak;
}

export class HabitService {
  async findAll(userId: string, includeArchived = false) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    const habits = await prisma.habit.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        logs: {
          where: { date: { gte: threeMonthsAgo } },
          orderBy: { date: "desc" },
          select: { date: true, isCompleted: true },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return habits.map((h) => ({
      ...h,
      logs: h.logs.map((l) => l.date.toISOString().split("T")[0]),
    }));
  }

  async findById(userId: string, id: string) {
    const habit = await prisma.habit.findFirst({
      where: { id, userId },
      include: {
        logs: {
          orderBy: { date: "desc" },
          select: { date: true, isCompleted: true },
        },
      },
    });
    if (!habit) throw new AppError(404, "Habit not found");
    return {
      ...habit,
      logs: habit.logs.map((l) => ({
        date: l.date.toISOString().split("T")[0],
        isCompleted: l.isCompleted,
      })),
    };
  }

  async create(userId: string, input: CreateHabitInput) {
    const data: Record<string, unknown> = {
      userId,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? "OTROS",
      priority: input.priority ?? 1,
      frequency: input.frequency ?? null,
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: input.endDate ? new Date(input.endDate) : null,
    };

    const habit = await prisma.habit.create({
      data: data as Parameters<typeof prisma.habit.create>[0]["data"],
    });
    return { ...habit, logs: [] };
  }

  async update(userId: string, id: string, input: UpdateHabitInput) {
    const existing = await prisma.habit.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, "Habit not found");

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.isArchived !== undefined) data.isArchived = input.isArchived;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate) : null;

    const habit = await prisma.habit.update({
      where: { id },
      data: data as Parameters<typeof prisma.habit.update>[0]["data"],
    });
    return habit;
  }

  async checkIn(userId: string, habitId: string, dateStr?: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    const date = dateStr ? normalizeDate(new Date(dateStr + "T00:00:00")) : normalizeDate(new Date());
    if (isNaN(date.getTime())) throw new AppError(400, "Invalid date");

    const existing = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date } },
    });

    if (existing) {
      return { alreadyCheckedIn: true, streak: habit.streakCount };
    }

    await prisma.habitLog.create({
      data: { habitId, date, isCompleted: true },
    });

    const logs = await prisma.habitLog.findMany({
      where: { habitId, isCompleted: true },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    const streak = calculateStreak(logs.map((l) => l.date));
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: streak },
    });

    return { alreadyCheckedIn: false, streak };
  }

  async undoCheckIn(userId: string, habitId: string, dateStr?: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    const date = dateStr ? normalizeDate(new Date(dateStr + "T00:00:00")) : normalizeDate(new Date());
    if (isNaN(date.getTime())) throw new AppError(400, "Invalid date");

    await prisma.habitLog.deleteMany({
      where: { habitId, date },
    });

    const logs = await prisma.habitLog.findMany({
      where: { habitId, isCompleted: true },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    const streak = calculateStreak(logs.map((l) => l.date));
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: streak },
    });

    return { streak };
  }

  async resetProgress(userId: string, habitId: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    await prisma.habitLog.deleteMany({ where: { habitId } });
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: 0 },
    });

    return { streak: 0 };
  }

  async delete(userId: string, habitId: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");
    await prisma.habit.delete({ where: { id: habitId } });
  }

  async findHabitsDueForReminder() {
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");
    const currentDay = now.getDay();

    const habits = await prisma.habit.findMany({
      where: {
        isArchived: false,
        frequency: { not: null },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            notificationEmail: true,
            language: true,
          },
        },
      },
    });

    return habits.filter((h) => {
      try {
        const freq = JSON.parse(h.frequency!);
        if (!freq.reminderTime) return false;

        const [remH, remM] = freq.reminderTime.split(":");
        if (remH !== currentHour || remM !== currentMinute) return false;

        if (freq.type === "weekly" && Array.isArray(freq.days)) {
          return freq.days.includes(currentDay);
        }

        return true;
      } catch {
        return false;
      }
    });
  }
}
