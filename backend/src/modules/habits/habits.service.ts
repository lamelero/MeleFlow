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
  const hasToday = sorted[0].getTime() === today.getTime();
  let expected = hasToday ? today : new Date(today.getTime() - 86400000);
  let streak = 0;

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
    const todayStart = normalizeDate(new Date());

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
        _count: { select: { logs: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    // Recalculate streak for all habits from all completed logs
    const allLogs = await prisma.habitLog.findMany({
      where: { habit: { userId }, isCompleted: true },
      select: { habitId: true, date: true },
    });
    const streakByHabit = new Map<string, number>();
    const grouped = new Map<string, Date[]>();
    for (const log of allLogs) {
      const arr = grouped.get(log.habitId) ?? [];
      arr.push(log.date);
      grouped.set(log.habitId, arr);
    }
    for (const [habitId, dates] of grouped) {
      streakByHabit.set(habitId, calculateStreak(dates));
    }

    return habits.map(({ _count, ...h }) => ({
      ...h,
      streakCount: streakByHabit.get(h.id) ?? 0,
      logs: h.logs.map((l) => l.date.toISOString().split("T")[0]),
      totalDays: _count.logs,
      completedToday: h.logs.some((l) => l.date.getTime() === todayStart.getTime()),
    }));
  }

  async findById(userId: string, id: string) {
    const todayStart = normalizeDate(new Date());
    const habit = await prisma.habit.findFirst({
      where: { id, userId },
      include: {
        logs: {
          orderBy: { date: "desc" },
          select: { date: true, isCompleted: true },
        },
        _count: { select: { logs: true } },
      },
    });
    if (!habit) throw new AppError(404, "Habit not found");
    return {
      ...habit,
      logs: habit.logs.map((l) => ({
        date: l.date.toISOString().split("T")[0],
        isCompleted: l.isCompleted,
      })),
      totalDays: habit._count.logs,
      completedToday: habit.logs.some((l) => l.date.getTime() === todayStart.getTime()),
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
      const totalDays = await prisma.habitLog.count({ where: { habitId, isCompleted: true } });
      return { alreadyCheckedIn: true, streak: habit.streakCount, totalDays };
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

    return { alreadyCheckedIn: false, streak, totalDays: logs.length };
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

    return { streak, totalDays: logs.length };
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

    return { streak: 0, totalDays: 0 };
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
            timezone: true,
          },
        },
      },
    });

    const tzCache = new Map<string, { hour: string; minute: string; day: number }>();

    function getLocalTime(tz: string | null) {
      const key = tz || "UTC";
      if (tzCache.has(key)) return tzCache.get(key)!;
      const opts: Intl.DateTimeFormatOptions = { timeZone: key, hour: "2-digit", minute: "2-digit", hour12: false };
      try {
        const timeStr = new Intl.DateTimeFormat("en-US", opts).format(now);
        const [hour, minute] = timeStr.split(":");
        const dayName = new Intl.DateTimeFormat("en-US", { timeZone: key, weekday: "short" }).format(now);
        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const result = { hour: hour.padStart(2, "0"), minute: minute.padStart(2, "0"), day: dayMap[dayName] ?? now.getUTCDay() };
        tzCache.set(key, result);
        return result;
      } catch {
        const fallback = { hour: String(now.getUTCHours()).padStart(2, "0"), minute: String(now.getUTCMinutes()).padStart(2, "0"), day: now.getUTCDay() };
        tzCache.set(key, fallback);
        return fallback;
      }
    }

    return habits.filter((h) => {
      try {
        const freq = JSON.parse(h.frequency!);
        if (!freq.reminderTime) return false;

        const tz = h.user.timezone;
        const local = getLocalTime(tz);

        const [remH, remM] = freq.reminderTime.split(":");
        if (remH !== local.hour || remM !== local.minute) return false;

        if (freq.type === "weekly") {
          return Array.isArray(freq.days) && freq.days.includes(local.day);
        }

        return true;
      } catch {
        return false;
      }
    });
  }
}
