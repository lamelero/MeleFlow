import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateHabitInput } from "./habits.schema";

export function calculateStreak(
  dates: Date[],
  frequency: string,
): number {
  if (dates.length === 0) return 0;

  const sorted = dates
    .map((d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt;
    })
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const step = frequency === "weekly" ? 7 : 1;
  let streak = 0;
  let expected = sorted[0].getTime() === today.getTime()
    ? today
    : new Date(today.getTime() - step * 86400000);

  for (const date of sorted) {
    if (date.getTime() === expected.getTime()) {
      streak++;
      expected = new Date(expected.getTime() - step * 86400000);
    } else if (date.getTime() < expected.getTime()) {
      break;
    }
  }

  return streak;
}

export class HabitService {
  async findAll(userId: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    const habits = await prisma.habit.findMany({
      where: { userId },
      include: {
        logs: {
          where: { date: { gte: threeMonthsAgo } },
          orderBy: { date: "desc" },
          select: { date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return habits.map((h) => ({
      ...h,
      logs: h.logs.map((l) => l.date.toISOString().split("T")[0]),
    }));
  }

  async create(userId: string, input: CreateHabitInput) {
    return prisma.habit.create({
      data: { userId, ...input },
    });
  }

  async checkIn(userId: string, habitId: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date: today } },
    });

    if (existing) {
      return { alreadyCheckedIn: true, streak: habit.streakCount };
    }

    await prisma.habitLog.create({
      data: { habitId, date: today },
    });

    const logs = await prisma.habitLog.findMany({
      where: { habitId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    const streak = calculateStreak(
      logs.map((l) => l.date),
      habit.frequency,
    );

    await prisma.habit.update({
      where: { id: habitId },
      data: { streakCount: streak },
    });

    return { alreadyCheckedIn: false, streak };
  }

  async delete(userId: string, habitId: string) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
    });
    if (!habit) throw new AppError(404, "Habit not found");

    await prisma.habit.delete({ where: { id: habitId } });
  }
}
