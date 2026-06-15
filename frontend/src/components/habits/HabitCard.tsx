import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Habit } from "../../store/habitStore";
import { useHabitStore } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";
import { LIST_ICONS } from "../lists/listIcons";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
}

interface DayCircle {
  dateStr: string;
  dayNum: number;
  dayLabel: string;
  isToday: boolean;
  completed: boolean;
  skipped: boolean;
}

function getWeekDays(habitStart: string | null, locale: string): DayCircle[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const days: DayCircle[] = [];
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({
      dateStr: d.toISOString().split("T")[0],
      dayNum: d.getUTCDate(),
      dayLabel: fmt.format(d),
      isToday: false,
      completed: false,
      skipped: false,
    });
  }
  days[6].isToday = true;
  return days;
}

export default function HabitCard({ habit, onEdit }: HabitCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { checkIn, undoCheckIn, deleteHabit, resetProgress } = useHabitStore();

  const catInfo = useMemo(() => {
    if (habit.habitCategory) {
      const dyn = habit.habitCategory;
      const IconComp = LIST_ICONS.find((i) => i.name === dyn.icon);
      return {
        color: dyn.color,
        bgColor: dyn.color + "20",
        label: dyn.name,
        labelEs: dyn.name,
        icon: () => IconComp ? <IconComp.icon className="h-4 w-4" /> : null,
      };
    }
    return HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;
  }, [habit.category, habit.habitCategory]);
  const Icon = catInfo.icon;
  const today = new Date().toISOString().split("T")[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);

  const logSet = useMemo(() => {
    const set = new Map<string, string>();
    for (const log of habit.logs) {
      set.set(log.date, log.status);
    }
    return set;
  }, [habit.logs]);

  const checkedToday = logSet.has(today) && logSet.get(today) === "completed";
  const skippedToday = logSet.has(today) && logSet.get(today) === "skipped";

  const weekDays = (() => {
    const wd = getWeekDays(habit.startDate, i18n.language);
    wd.forEach((d) => {
      const st = logSet.get(d.dateStr);
      if (st === "completed") d.completed = true;
      if (st === "skipped") d.skipped = true;
    });
    return wd;
  })();

  const score = useMemo(() => {
    if (!habit.startDate || habit.totalDays === 0) return 0;
    const start = new Date(habit.startDate);
    const now = new Date();
    const daysSince = Math.max(1, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.min(100, Math.round((habit.totalDays / daysSince) * 100));
  }, [habit]);

  const streakMilestone = [7, 15, 30, 60, 100, 180, 365].findLast(
    (m) => habit.streakCount >= m,
  );

  const milestoneColors: Record<number, string> = {
    7: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    15: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    30: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    60: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    100: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    180: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    365: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleCellClick(dateStr: string) {
    if (dateStr > today || pending) return;
    setPending(true);
    const currentStatus = logSet.get(dateStr);
    if (!currentStatus) {
      await checkIn(habit.id, dateStr, "completed");
    } else if (currentStatus === "completed") {
      await checkIn(habit.id, dateStr, "skipped");
    } else {
      await undoCheckIn(habit.id, dateStr);
    }
    setPending(false);
  }

  function handleDelete() {
    if (window.confirm(t("habits.deleteConfirm", { name: habit.name }))) {
      deleteHabit(habit.id);
    }
    setMenuOpen(false);
  }

  function handleReset() {
    if (window.confirm(t("habits.resetConfirm", { name: habit.name }))) {
      resetProgress(habit.id);
    }
    setMenuOpen(false);
  }

  function handleArchive() {
    useHabitStore.getState().updateHabit(habit.id, { isArchived: true });
    setMenuOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-gray-100/80 bg-white p-3 shadow-sm transition-all dark:border-gray-700/50 dark:bg-gray-900/95">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: catInfo.bgColor, color: catInfo.color }}
          >
            <Icon />
          </div>
          <div>
            <h3 className="font-urbanist text-[15px] font-medium text-gray-900 dark:text-gray-100">
              {habit.name}
            </h3>
            {habit.frequency && (
              <p className="font-urbanist text-xs font-medium" style={{ color: catInfo.color }}>
                {((): string => {
                  try {
                    const f = JSON.parse(habit.frequency);
                    if (f.type === "daily") return t("habits.daily") || "Daily";
                    if (f.type === "weekly") return t("habits.weekly") || "Weekly";
                    if (f.type === "monthly") return t("habits.monthly") || "Monthly";
                    return habit.frequency;
                  } catch {
                    return habit.frequency;
                  }
                })()}
              </p>
            )}
          </div>
        </div>
        <span className="shrink-0 font-urbanist text-xs text-gray-400 dark:text-gray-500">
          {habit.totalDays}d
        </span>
      </div>

      {/* 7-day squares */}
      <div className="mb-3 flex justify-center gap-1.5">
        {weekDays.map((day) => (
          <button
            key={day.dateStr}
            type="button"
            disabled={day.dateStr > today || pending}
            onClick={() => handleCellClick(day.dateStr)}
            className="flex flex-col items-center gap-px"
          >
            <span className="font-urbanist text-[10px] font-medium text-gray-400 dark:text-gray-500">
              {day.dayLabel}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold transition-all relative
                ${day.dateStr > today ? "opacity-20" : "cursor-pointer hover:scale-105"}
                ${!day.completed && !day.skipped && !day.isToday ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500" : ""}
                ${day.isToday && !day.completed && !day.skipped ? "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200" : ""}
                ${day.completed ? "text-white" : ""}
                ${day.skipped ? "" : ""}
              `}
              style={
                day.completed
                  ? { backgroundColor: catInfo.color }
                  : day.skipped
                    ? { backgroundColor: catInfo.color + "25", color: catInfo.color }
                    : day.isToday
                      ? { border: `2px solid ${catInfo.color}66` }
                      : undefined
              }
            >
              {day.dayNum}
              {day.skipped && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 32 32" fill="none" stroke={catInfo.color} strokeWidth={1.5} opacity={0.5}>
                  <line x1="6" y1="26" x2="26" y2="6" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Streak + Score row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-urbanist text-xs font-medium text-gray-600 dark:text-gray-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13z" />
              <path d="M12 17a2 2 0 1 0 0-4c-.8.5-1.2 1.2-1 2a1 1 0 0 0 1 2z" />
            </svg>
            {habit.streakCount}d
          </span>
          {streakMilestone && (
            <span className={`rounded-full px-1.5 py-0.5 font-urbanist text-[9px] font-medium ${milestoneColors[streakMilestone] ?? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"}`}>
              {streakMilestone}d
            </span>
          )}
        </div>
        <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
          {t("habits.score") || "Score"}: {score}%
        </span>
      </div>

      {/* Action buttons + bottom sheet */}
      <div className="flex items-center gap-1 border-t border-gray-100 pt-2 dark:border-gray-800">
        <button
          onClick={() => handleCellClick(today)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-urbanist text-xs font-medium transition-all"
          style={{
            backgroundColor: checkedToday ? `${catInfo.color}1A` : skippedToday ? `${catInfo.color}25` : catInfo.color,
            color: (checkedToday || skippedToday) ? catInfo.color : "#fff",
          }}
        >
          {checkedToday ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t("habits.doneToday")}
            </>
          ) : skippedToday ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
              {t("habits.skipped") || "Skipped"}
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t("habits.checkIn")}
            </>
          )}
        </button>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigate(`/app/habits/${habit.id}?tab=calendar`)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t("habits.calendar") || "Calendar"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
          <button
            onClick={() => navigate(`/app/habits/${habit.id}?tab=stats`)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t("habits.stats") || "Statistics"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <div
                  className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <button
                    onClick={() => { navigate(`/app/habits/${habit.id}?tab=calendar`); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    {t("habits.calendar") || "Calendar"}
                  </button>
                  <button
                    onClick={() => { navigate(`/app/habits/${habit.id}?tab=stats`); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    {t("habits.stats") || "Statistics"}
                  </button>
                  <button
                    onClick={() => { onEdit(habit); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    {t("habits.edit")}
                  </button>
                  <button
                    onClick={handleArchive}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="4" width="20" height="4" rx="1" />
                      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
                      <path d="M10 12h4" />
                    </svg>
                    {t("habits.archive")}
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700" />
                  <button
                    onClick={handleReset}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    {t("habits.reset")}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    {t("habits.delete")}
                  </button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
