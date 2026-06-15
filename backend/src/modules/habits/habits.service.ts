import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateHabitInput, UpdateHabitInput } from "./habits.schema";

function normalizeDate(d: Date): Date {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

interface StreakLog {
  date: Date;
  status: string;
}

function getActiveDays(frequency: string | null): number[] | null {
  if (!frequency) return null;
  try {
    const f = JSON.parse(frequency);
    if (f.type === "weekly" && Array.isArray(f.days) && f.days.length > 0) {
      return f.days;
    }
    return null;
  } catch {
    return null;
  }
}

function isActiveDay(day: number, activeDays: number[] | null): boolean {
  if (!activeDays) return true;
  // Convert JS getDay() (0=Sun) to UI index (0=Mon)
  const uiIdx = day === 0 ? 6 : day - 1;
  return activeDays.includes(uiIdx);
}

export function calculateStreak(logs: StreakLog[], frequency: string | null = null): number {
  if (logs.length === 0) return 0;

  const activeDays = getActiveDays(frequency);

  // Build a map: dateStr → status
  const statusMap = new Map<string, string>();
  for (const log of logs) {
    const d = normalizeDate(log.date);
    if (!isNaN(d.getTime())) {
      statusMap.set(d.toISOString().split("T")[0], log.status);
    }
  }

  const today = normalizeDate(new Date());

  // Walk backwards from today
  let cursor = new Date(today);
  let streak = 0;
  const maxLookback = 365; // safety limit

  // If today is not completed, start streak from yesterday
  const todayStr = today.toISOString().split("T")[0];
  if (statusMap.get(todayStr) !== "completed") {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  for (let i = 0; i < maxLookback; i++) {
    const dateStr = cursor.toISOString().split("T")[0];
    const dayOfWeek = cursor.getUTCDay();
    const hasCompletedForDay = statusMap.get(dateStr) === "completed";

    // Check if this day is active for this habit's frequency
    if (activeDays && !activeDays.includes(dayOfWeek) && !hasCompletedForDay) {
      // Inactive day, skip it (move cursor backward)
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }

    const status = statusMap.get(dateStr);

    if (status === "completed") {
      streak++;
    } else if (status === "skipped") {
      // Skipped doesn't break streak but doesn't add either
    } else {
      // No log or any other status → streak broken
      break;
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);

    // Safety: don't look back forever
    if (i > 700) break;
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
          select: { date: true, status: true },
        },
        habitCategory: true,
        _count: { select: { logs: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    // Recalculate streak for all habits from all logs
    const allLogs = await prisma.habitLog.findMany({
      where: { habit: { userId } },
      select: { habitId: true, date: true, status: true },
    });
    const streakByHabit = new Map<string, number>();
    const grouped = new Map<string, { date: Date; status: string }[]>();
    for (const log of allLogs) {
      const arr = grouped.get(log.habitId) ?? [];
      arr.push({ date: log.date, status: log.status });
      grouped.set(log.habitId, arr);
    }
    for (const [habitId, logs] of grouped) {
      const habit = habits.find((h) => h.id === habitId);
      streakByHabit.set(habitId, calculateStreak(logs, habit?.frequency ?? null));
    }

    return habits.map(({ _count, ...h }) => ({
      ...h,
      streakCount: streakByHabit.get(h.id) ?? 0,
      logs: h.logs.map((l) => ({ date: l.date.toISOString().split("T")[0], status: l.status })),
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
          select: { date: true, status: true },
        },
        habitCategory: true,
        _count: { select: { logs: true } },
      },
    });
    if (!habit) throw new AppError(404, "Habit not found");
    return {
      ...habit,
      logs: habit.logs.map((l) => ({ date: l.date.toISOString().split("T")[0], status: l.status })),
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
      categoryId: input.categoryId ?? null,
    };

    const habit = await prisma.habit.create({
      data: data as Parameters<typeof prisma.habit.create>[0]["data"],
      include: { habitCategory: true },
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
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;

    const habit = await prisma.habit.update({
      where: { id },
      data: data as Parameters<typeof prisma.habit.update>[0]["data"],
      include: { habitCategory: true },
    });
    return habit;
  }

  async checkIn(userId: string, habitId: string, dateStr?: string, statusVal?: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    const date = dateStr ? normalizeDate(new Date(dateStr + "T00:00:00Z")) : normalizeDate(new Date());
    if (isNaN(date.getTime())) throw new AppError(400, "Invalid date");

    const status = statusVal === "skipped" ? "skipped" : "completed";

    const existing = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date } },
    });

    if (existing) {
      if (existing.status === status) {
        // Same status - nothing to do
        const totalDays = await prisma.habitLog.count({ where: { habitId, status: "completed" } });
        return { alreadyCheckedIn: true, streak: habit.streakCount, totalDays };
      }
      // Update existing log to new status
      await prisma.habitLog.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      await prisma.habitLog.create({
        data: { habitId, date, status },
      });
    }

    // Recalculate streak from all logs
    const logs = await prisma.habitLog.findMany({
      where: { habitId },
      orderBy: { date: "desc" },
      select: { date: true, status: true },
    });

    const streak = calculateStreak(logs, habit.frequency);
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: streak },
    });

    const totalDays = await prisma.habitLog.count({ where: { habitId, status: "completed" } });

    return { alreadyCheckedIn: false, streak, totalDays };
  }

  async undoCheckIn(userId: string, habitId: string, dateStr?: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    const date = dateStr ? normalizeDate(new Date(dateStr + "T00:00:00Z")) : normalizeDate(new Date());
    if (isNaN(date.getTime())) throw new AppError(400, "Invalid date");

    await prisma.habitLog.deleteMany({
      where: { habitId, date },
    });

    const logs = await prisma.habitLog.findMany({
      where: { habitId },
      orderBy: { date: "desc" },
      select: { date: true, status: true },
    });

    const streak = calculateStreak(logs, habit.frequency);
    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: streak },
    });

    const totalDays = await prisma.habitLog.count({ where: { habitId, status: "completed" } });

    return { streak, totalDays };
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
            notificationPrefs: true,
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
