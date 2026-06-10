import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import { useHabitStore, type Habit } from "../../store/habitStore";
import { HABIT_CATEGORIES } from "../../lib/habit-categories";
import HabitCalendarTab from "../../components/habits/HabitCalendarTab";
import HabitStatsTab from "../../components/habits/HabitStatsTab";
import HabitEditTab from "../../components/habits/HabitEditTab";

const TABS = ["calendar", "stats", "edit"] as const;

export default function HabitDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { fetchHabit } = useHabitStore();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = searchParams.get("tab") || "calendar";
  const tabIndex = TABS.indexOf(activeTab as typeof TABS[number]);
  const safeTab = tabIndex >= 0 ? activeTab : "calendar";

  const loadHabit = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchHabit(id)
      .then(setHabit)
      .finally(() => setLoading(false));
  }, [id, fetchHabit]);

  useEffect(() => {
    loadHabit();
  }, [loadHabit, refreshKey]);

  function handleChange() {
    setRefreshKey((k) => k + 1);
  }

  if (loading && !habit) {
    return (
      <AppLayout title="">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!habit) {
    return (
      <AppLayout title="">
        <div className="mx-auto max-w-lg p-6 text-center">
          <p className="font-urbanist text-sm text-gray-500">Habit not found</p>
          <button
            onClick={() => navigate("/app/habits")}
            className="mt-4 rounded-lg bg-primary px-4 py-2 font-urbanist text-sm text-white"
          >
            Back to habits
          </button>
        </div>
      </AppLayout>
    );
  }

  const catInfo = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.OTROS;
  const Icon = catInfo.icon;

  function switchTab(tab: string) {
    setSearchParams({ tab });
  }

  return (
    <AppLayout title={habit.name}>
      <div className="mx-auto w-full max-w-2xl p-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/app/habits")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </button>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: catInfo.bgColor, color: catInfo.color }}
          >
            <Icon />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
              {habit.name}
            </h1>
            <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
              {catInfo.label}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`flex-1 rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium transition-all ${
                safeTab === tab
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {t(`habits.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={safeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {safeTab === "calendar" && <HabitCalendarTab habit={habit} onChange={handleChange} />}
          {safeTab === "stats" && <HabitStatsTab habit={habit} />}
          {safeTab === "edit" && <HabitEditTab habit={habit} />}
        </motion.div>
      </div>
    </AppLayout>
  );
}
