import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import HabitCard from "../../components/habits/HabitCard";
import HabitFormModal from "../../components/habits/HabitFormModal";
import PullToRefresh from "../../components/PullToRefresh";
import { useHabitStore, type Habit } from "../../store/habitStore";

export default function HabitsView() {
  const { t } = useTranslation();
  const { habits, isLoading, fetchHabits, createHabit } = useHabitStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  async function handleSaveHabit(data: {
    name: string;
    description?: string | null;
    category: string;
    priority: number;
    frequency: string | null;
    startDate?: string;
    endDate?: string | null;
  }) {
    if (editingHabit) {
      await useHabitStore.getState().updateHabit(editingHabit.id, data);
    } else {
      await createHabit(data);
    }
    setEditingHabit(null);
  }

  function handleEditHabit(habit: Habit) {
    setEditingHabit(habit);
    setFormOpen(true);
  }

  const activeHabits = habits.filter((h) => !h.isArchived);
  const archivedHabits = habits.filter((h) => h.isArchived);

  return (
    <AppLayout title={t("dashboard.habits")}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        <PullToRefresh onRefresh={() => fetchHabits()} isLoading={isLoading}>
          <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
            <div className="flex items-center justify-between">
              <h1 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("dashboard.habits")}
              </h1>
              <button
                onClick={() => { setEditingHabit(null); setFormOpen(true); }}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t("dashboard.newHabit")}
              </button>
            </div>

            {activeHabits.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800"
              >
                <p className="font-urbanist text-sm text-gray-400">
                  {t("dashboard.noHabits")}
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeHabits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} onEdit={handleEditHabit} />
                ))}
              </div>
            )}

            {archivedHabits.length > 0 && (
              <div>
                <h2 className="mb-3 font-outfit text-base font-semibold text-gray-500 dark:text-gray-400">
                  {t("dashboard.archived")}
                </h2>
                <div className="flex flex-col gap-3 opacity-50">
                  {archivedHabits.map((habit) => (
                    <HabitCard key={habit.id} habit={habit} onEdit={handleEditHabit} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </PullToRefresh>

        <HabitFormModal
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setEditingHabit(null); }}
          onSave={handleSaveHabit}
          habit={editingHabit}
        />
      </motion.div>
    </AppLayout>
  );
}
