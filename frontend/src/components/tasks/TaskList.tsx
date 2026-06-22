import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TaskCard from "./TaskCard";
import PullToRefresh from "../PullToRefresh";
import EmptyState from "../EmptyState";
import { TaskSkeleton } from "../Skeletons";
import type { FilterPreset } from "./TaskFilters";

interface TaskListProps {
  filter?: {
    listId?: string;
    status?: "completed" | "pending";
    tagId?: string;
    preset?: FilterPreset;
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
    const apiFilter: Parameters<typeof fetchTasks>[0] = {
      listId: filter?.listId,
      status: filter?.status,
      tagId: filter?.tagId,
    };
    if (filter?.preset && filter.preset !== "all") {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      if (filter.preset === "today") {
        apiFilter.dueDateFrom = today;
        apiFilter.dueDateTo = today;
      } else if (filter.preset === "week") {
        apiFilter.dueDateFrom = today;
        const weekLater = new Date(now);
        weekLater.setDate(weekLater.getDate() + 7);
        apiFilter.dueDateTo = weekLater.toISOString().split("T")[0];
      } else if (filter.preset === "overdue") {
        apiFilter.dueDateTo = today;
        apiFilter.status = "pending";
      } else if (filter.preset === "noDate") {
        // Client-side filter - fetch all, then filter locally
      }
    }
    fetchTasks(apiFilter);
  }, [filter?.listId, filter?.status, filter?.tagId, filter?.preset, fetchTasks]);

  const sortedTasks = useMemo(() => {
    let filtered = [...tasks];
    if (filter?.preset === "noDate") {
      filtered = filtered.filter((t) => !t.dueDate);
    }
    if (filter?.preset === "overdue") {
      const today = new Date().toISOString().split("T")[0];
      filtered = filtered.filter((t) => t.dueDate && t.dueDate.split("T")[0] < today && !t.isCompleted);
    }
    return filtered.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      if (a.isCompleted) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.priority - b.priority;
    });
  }, [tasks, filter?.preset]);

  const content = isLoading ? (
    <div className="space-y-2">
      <TaskSkeleton />
      <TaskSkeleton />
      <TaskSkeleton />
    </div>
  ) : error ? (
    <div className="rounded-xl bg-red-50 px-4 py-3 text-center font-urbanist text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
      <p>{error}</p>
      <button
        onClick={() => fetchTasks(filter)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-800/40 dark:text-red-300 dark:hover:bg-red-800/60"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Tap to retry
      </button>
    </div>
  ) : sortedTasks.length === 0 ? (
    <EmptyState
      icon={
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      title={effectiveEmptyMessage}
    />
  ) : (
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

  return (
    <PullToRefresh onRefresh={() => fetchTasks(filter)} isLoading={isLoading}>
      {content}
    </PullToRefresh>
  );
}
