import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { showConfirm } from "../ConfirmModal";
import toast from "react-hot-toast";
import type { Habit } from "../../store/habitStore";
import { useHabitStore } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";
import HabitFormModal from "./HabitFormModal";

interface HabitEditTabProps {
  habit: Habit;
}

export default function HabitEditTab({ habit }: HabitEditTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateHabit, deleteHabit, resetProgress } = useHabitStore();
  const catInfo = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;
  const Icon = catInfo.icon;
  const [formOpen, setFormOpen] = useState(false);

  const freqLabel = (() => {
    try {
      const f = JSON.parse(habit.frequency || "{}");
      if (f.type === "daily") return t("habits.daily") || "Daily";
      if (f.type === "weekly") return t("habits.weekly") || "Weekly";
      if (f.type === "monthly") return t("habits.monthly") || "Monthly";
      return habit.frequency || "";
    } catch {
      return habit.frequency || "";
    }
  })();

  async function handleSave(data: {
    name: string;
    description?: string | null;
    category: string;
    priority: number;
    frequency: string | null;
    startDate?: string;
    endDate?: string | null;
  }) {
    await updateHabit(habit.id, data);
    toast.success("Habit updated");
  }

  function handleArchive() {
    updateHabit(habit.id, { isArchived: true });
    toast.success("Habit archived");
    navigate("/app/habits");
  }

  async function handleReset() {
    const ok = await showConfirm({ title: t("habits.resetConfirm", { name: habit.name }), message: "" });
    if (!ok) return;
    resetProgress(habit.id);
    toast.success("Progress reset");
  }

  async function handleDelete() {
    const ok = await showConfirm({ title: t("habits.deleteConfirm", { name: habit.name }), message: "" });
    if (!ok) return;
    deleteHabit(habit.id);
    navigate("/app/habits");
  }

  return (
    <>
      <div className="space-y-3">
        {/* Basic info fields */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <button
            onClick={() => setFormOpen(true)}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                {t("habits.name") || "Name"}
              </p>
              <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                {habit.name}
              </p>
            </div>
            <svg className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => setFormOpen(true)}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                {t("habits.category") || "Category"}
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded"
                  style={{ backgroundColor: catInfo.bgColor, color: catInfo.color }}
                >
                  <Icon />
                </span>
                <span className="font-urbanist text-sm text-gray-900 dark:text-gray-100">
                  {catInfo.label}
                </span>
              </div>
            </div>
            <svg className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                {t("habits.frequency") || "Frequency"}
              </p>
              <p className="font-urbanist text-sm text-gray-900 dark:text-gray-100">
                {freqLabel}
              </p>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="rounded-md bg-primary/10 px-2 py-1 font-urbanist text-[11px] font-medium text-primary"
            >
              {t("habits.change") || "Change"}
            </button>
          </div>

          <div className="flex w-full items-center gap-3 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                {t("habits.startDate") || "Start date"}
              </p>
              <p className="font-urbanist text-sm text-gray-900 dark:text-gray-100">
                {habit.startDate ? new Date(habit.startDate).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-red-100 bg-white shadow-sm dark:border-red-900/30 dark:bg-gray-900">
          <button
            onClick={handleArchive}
            className="flex w-full items-center gap-3 border-b border-red-100 px-4 py-3 text-left transition-colors hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/10"
          >
            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="4" width="20" height="4" rx="1" />
              <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
              <path d="M10 12h4" />
            </svg>
            <span className="flex-1 font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("habits.archive") || "Archive"}
            </span>
          </button>
          <button
            onClick={handleReset}
            className="flex w-full items-center gap-3 border-b border-red-100 px-4 py-3 text-left transition-colors hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/10"
          >
            <svg className="h-4 w-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span className="flex-1 font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("habits.reset") || "Reset"}
            </span>
          </button>
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
          >
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <span className="flex-1 font-urbanist text-sm font-medium text-red-600 dark:text-red-400">
              {t("habits.delete") || "Delete"}
            </span>
          </button>
        </div>
      </div>

      {/* Edit modal for full form */}
      <HabitFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        habit={habit}
      />
    </>
  );
}
