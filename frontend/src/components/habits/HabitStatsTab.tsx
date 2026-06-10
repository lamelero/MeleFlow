import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Habit } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";

interface HabitStatsTabProps {
  habit: Habit;
}

export default function HabitStatsTab({ habit }: HabitStatsTabProps) {
  const { t } = useTranslation();
  const catInfo = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;

  const stats = useMemo(() => {
    const today = new Date();
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const todayStr = new Date(todayUTC).toISOString().split("T")[0];

    // This week (Mon-Sun) in UTC
    const dayOfWeek = new Date(todayUTC).getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStartMs = todayUTC - mondayOffset * 86400000;
    const weekStart = new Date(weekStartMs).toISOString().split("T")[0];

    // This month
    const monthStart = `${new Date(todayUTC).getUTCFullYear()}-${String(new Date(todayUTC).getUTCMonth() + 1).padStart(2, "0")}-01`;

    // This year
    const yearStart = `${new Date(todayUTC).getUTCFullYear()}-01-01`;

    let thisWeek = 0;
    let thisMonth = 0;
    let thisYear = 0;

    for (const log of habit.logs) {
      if (log >= yearStart) thisYear++;
      if (log >= monthStart) thisMonth++;
      if (log >= weekStart) thisWeek++;
    }

    // Score
    const score = habit.startDate && habit.totalDays > 0
      ? Math.min(100, Math.round((habit.totalDays / Math.max(1, Math.round((today.getTime() - new Date(habit.startDate).getTime()) / (1000 * 60 * 60 * 24)))) * 100))
      : 0;

    // Best streak (frontend calculation from logs)
    const sorted = [...habit.logs].sort();
    let bestStreak = 0;
    let currentStreak = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      }
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    }

    return { score, thisWeek, thisMonth, thisYear, bestStreak };
  }, [habit]);

  // SVG gauge
  const gaugeRadius = 54;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (stats.score / 100) * gaugeCircumference;

  return (
    <div className="space-y-4">
      {/* Score gauge */}
      <div className="flex justify-center rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="relative flex items-center justify-center">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={gaugeRadius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
              className="dark:stroke-gray-700"
            />
            <circle
              cx="70"
              cy="70"
              r={gaugeRadius}
              fill="none"
              stroke={catInfo.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={gaugeCircumference}
              strokeDashoffset={gaugeOffset}
              transform="rotate(-90 70 70)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-outfit text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.score}%
            </span>
            <span className="font-urbanist text-[10px] text-gray-400 dark:text-gray-500">
              {t("habits.score") || "Score"}
            </span>
          </div>
        </div>
      </div>

      {/* Streak cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">
            {t("habits.currentStreak") || "Current streak"}
          </p>
          <p className="mt-1 font-outfit text-xl font-bold text-rose-500">
            {habit.streakCount}
            <span className="ml-1 font-urbanist text-sm font-normal text-gray-400">
              {t("habits.days") || "days"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">
            {t("habits.bestStreak") || "Best streak"}
          </p>
          <p className="mt-1 font-outfit text-xl font-bold text-emerald-500">
            {stats.bestStreak}
            <span className="ml-1 font-urbanist text-sm font-normal text-gray-400">
              {t("habits.days") || "days"}
            </span>
          </p>
        </div>
      </div>

      {/* Period stats */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("habits.timesCompleted") || "Times completed"}
        </h3>
        <div className="space-y-2">
          {[
            { label: t("habits.thisWeek") || "This week", value: stats.thisWeek },
            { label: t("habits.thisMonth") || "This month", value: stats.thisMonth },
            { label: t("habits.thisYear") || "This year", value: stats.thisYear },
            { label: t("habits.total") || "Total", value: habit.totalDays },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
            >
              <span className="font-urbanist text-xs text-gray-600 dark:text-gray-400">
                {row.label}
              </span>
              <span className="font-urbanist text-sm font-semibold text-gray-900 dark:text-gray-100">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
