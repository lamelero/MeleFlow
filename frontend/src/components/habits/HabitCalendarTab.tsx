import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Habit } from "../../store/habitStore";
import { useHabitStore } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";

interface HabitCalendarTabProps {
  habit: Habit;
  onChange?: () => void;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  return days;
}

export default function HabitCalendarTab({ habit, onChange }: HabitCalendarTabProps) {
  const { t, i18n } = useTranslation();
  const { checkIn, undoCheckIn } = useHabitStore();
  const catInfo = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const [viewDate, setViewDate] = useState(() => new Date());
  const logSet = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of habit.logs) {
      map.set(log.date, log.status);
    }
    return map;
  }, [habit.logs]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  const monthName = (() => {
    const raw = viewDate.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function handleDayClick(day: number) {
    if (!day) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr > todayStr) return;
    const currentStatus = logSet.get(dateStr);
    if (!currentStatus) {
      await checkIn(habit.id, dateStr, "completed");
    } else if (currentStatus === "completed") {
      await checkIn(habit.id, dateStr, "skipped");
    } else {
      await undoCheckIn(habit.id, dateStr);
    }
    onChange?.();
  }

  const getDayStatus = useCallback((dateStr: string, day: number) => {
    if (!day) return "empty";
    if (dateStr > todayStr) return "future";
    const st = logSet.get(dateStr);
    if (st === "completed") return "completed";
    if (st === "skipped") return "skipped";
    if (dateStr === todayStr) return "today";
    return "missed";
  }, [logSet, todayStr]);

  const monthlyStreak = useMemo(() => {
    let current = 0;
    const days = monthDays.filter((d): d is number => d !== null && d !== undefined);
    for (let i = days.length - 1; i >= 0; i--) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(days[i]).padStart(2, "0")}`;
      if (dateStr > todayStr) continue;
      if (logSet.has(dateStr)) {
        current++;
      } else {
        break;
      }
    }
    return current;
  }, [monthDays, year, month, logSet, todayStr]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-1 text-center font-urbanist text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {monthDays.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const status = getDayStatus(dateStr, day);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={status === "future" || status === "empty"}
              onClick={() => handleDayClick(day)}
              className={`relative flex items-center justify-center py-1 font-urbanist text-xs transition-all ${
                status === "future" ? "text-gray-300 dark:text-gray-600" : "cursor-pointer"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium relative ${
                  status === "completed" || status === "skipped" || status === "missed"
                    ? "text-white"
                    : status === "today"
                      ? "border-2 border-primary/40 bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      : ""
                }`}
                style={
                  status === "completed"
                    ? { backgroundColor: "#14B8A6" }
                    : status === "skipped"
                      ? { backgroundColor: "#F59E0B" }
                      : status === "missed"
                        ? { backgroundColor: "#EF4444" }
                        : undefined
                }
              >
                {day}
                {status === "skipped" && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 32 32" fill="none" stroke={catInfo.color} strokeWidth={1.5} opacity={0.5}>
                    <line x1="8" y1="24" x2="24" y2="8" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Monthly streak */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
        <span className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
          {t("habits.monthlyStreak") || "Monthly streak"}
        </span>
        <span className="font-urbanist text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthlyStreak}d
        </span>
      </div>
    </div>
  );
}
