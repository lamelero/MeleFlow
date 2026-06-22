import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import HabitCard from "../../components/habits/HabitCard";
import HabitFormModal from "../../components/habits/HabitFormModal";
import EmptyState from "../../components/EmptyState";
import { HabitsGridSkeleton } from "../../components/Skeletons";
import PullToRefresh from "../../components/PullToRefresh";
import { useHabitStore, type Habit } from "../../store/habitStore";
import { Heart } from "lucide-react";

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

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

            {isLoading && activeHabits.length === 0 ? (
              <HabitsGridSkeleton />
            ) : activeHabits.length === 0 ? (
              <EmptyState
                icon={<Heart className="h-6 w-6" />}
                title={t("dashboard.noHabits")}
                description="Start building your routine by creating your first habit"
                action={
                  <button
                    onClick={() => { setEditingHabit(null); setFormOpen(true); }}
                    className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
                  >
                    {t("dashboard.newHabit")}
                  </button>
                }
              />
            ) : (
              <motion.div
                className="flex flex-col gap-3"
                variants={containerVariants}
                initial="initial"
                animate="animate"
              >
                {activeHabits.map((habit) => (
                  <motion.div key={habit.id} variants={itemVariants}>
                    <HabitCard habit={habit} onEdit={handleEditHabit} />
                  </motion.div>
                ))}
              </motion.div>
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
