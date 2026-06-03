import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TaskCard from "./TaskCard";

interface TaskListProps {
  filter?: {
    listId?: string;
    status?: "completed" | "pending";
    tagId?: string;
  };
  emptyMessage?: string;
  onTaskClick: (task: Task) => void;
}

const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

export default function TaskList({
  filter,
  emptyMessage,
  onTaskClick,
}: TaskListProps) {
  const { t } = useTranslation();
  const effectiveEmptyMessage = emptyMessage ?? t("habits.noTasks");
  const { tasks, isLoading, error, fetchTasks } = useTaskStore();

  useEffect(() => {
    fetchTasks(filter);
  }, [filter?.listId, filter?.status, filter?.tagId, fetchTasks]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      if (a.isCompleted) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.priority - b.priority;
    });
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800"
      >
        <svg
          className="mx-auto mb-4 h-16 w-16 dark:opacity-70"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="12" y="10" width="40" height="44" rx="4" stroke="#14B8A6" strokeWidth="2" strokeDasharray="4 3" fill="rgba(20,184,166,0.05)" />
          <path d="M22 26h20" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <path d="M22 34h14" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M22 42h8" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <circle cx="48" cy="48" r="10" fill="rgba(20,184,166,0.1)" stroke="#14B8A6" strokeWidth="1.5" />
          <path d="M45 48l2 2 4-4" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-urbanist text-sm text-gray-400">{effectiveEmptyMessage}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-2"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {sortedTasks.map((task: Task) => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
