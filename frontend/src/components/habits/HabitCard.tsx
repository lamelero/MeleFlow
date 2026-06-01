import { useState, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import type { Habit } from "../../store/habitStore";
import { useHabitStore } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";
import HabitCalendar from "./HabitCalendar";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
}

export default function HabitCard({ habit, onEdit }: HabitCardProps) {
  const { checkIn, undoCheckIn, deleteHabit, resetProgress } = useHabitStore();
  const catInfo = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;
  const today = new Date().toISOString().split("T")[0];
  const checkedToday = habit.logs.includes(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleCalendarClick(dateStr: string) {
    if (dateStr > today) return;
    if (habit.logs.includes(dateStr)) {
      undoCheckIn(habit.id, dateStr);
    } else {
      checkIn(habit.id, dateStr);
    }
  }

  function handleDelete() {
    if (window.confirm(`Delete "${habit.name}"? This cannot be undone.`)) {
      deleteHabit(habit.id);
    }
    setMenuOpen(false);
  }

  function handleReset() {
    if (window.confirm(`Reset progress for "${habit.name}"?`)) {
      resetProgress(habit.id);
    }
    setMenuOpen(false);
  }

  function handleArchive() {
    useHabitStore.getState().updateHabit(habit.id, { isArchived: true });
    setMenuOpen(false);
  }

  const streakMilestone = [7, 15, 30, 60, 90, 180, 365].find(
    (m) => habit.streakCount >= m,
  );

  const Icon = catInfo.icon;

  return (
    <div
      className="group relative overflow-hidden rounded-xl border bg-white/95 p-3 transition-all hover:shadow-sm dark:border-gray-700/50 dark:bg-gray-900/95"
      style={{ borderColor: `${catInfo.color}20` }}
    >
      {/* Top row: icon + name + streak + menu */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: catInfo.bgColor, color: catInfo.color }}
          >
            <Icon />
          </div>
          <div>
            <h3 className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
              {habit.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">
                🔥 {habit.streakCount}d
              </span>
              {streakMilestone && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-urbanist text-[9px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  {streakMilestone}d
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Context menu dots */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
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
                className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <button
                  onClick={() => { onEdit(habit); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={handleReset}
                  className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Reset
                </button>
                <button
                  onClick={handleArchive}
                  className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Archive
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Calendar */}
      <div className="mb-2">
        <HabitCalendar logs={habit.logs} onCellClick={handleCalendarClick} />
      </div>

      {/* Check-in button */}
      <button
        onClick={() => handleCalendarClick(today)}
        className={`w-full rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium transition-all ${
          checkedToday
            ? "bg-primary/10 text-primary"
            : "text-white"
        }`}
        style={{
          backgroundColor: checkedToday ? undefined : catInfo.color,
        }}
      >
        {checkedToday ? (
          <span className="flex items-center justify-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Done today
          </span>
        ) : (
          <span className="flex items-center justify-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Check in
          </span>
        )}
      </button>
    </div>
  );
}
