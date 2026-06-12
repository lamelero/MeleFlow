import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TagPill from "../tags/TagPill";

const priorityColors: Record<number, string> = {
  1: "#EF4444",
  2: "#F59E0B",
  3: "#3B82F6",
  4: "#9CA3AF",
};

function isDueDateOverdue(dueDate: string): boolean {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function renderDueDate(dueDate: string, lang: string): string {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays < 0) {
    const past = Math.abs(diffDays);
    if (past === 0) return "Overdue";
    if (past === 1) return lang.startsWith("es") ? "Ayer" : "Yesterday";
    return lang.startsWith("es") ? `Vence hace ${past}d` : `${past}d overdue`;
  }
  if (diffDays === 0) return lang.startsWith("es") ? "Hoy" : "Today";
  if (diffDays === 1) return lang.startsWith("es") ? "Mañana" : "Tomorrow";
  if (diffDays <= 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const esDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dayName = lang.startsWith("es") ? esDays[due.getDay()] : days[due.getDay()];
    return `${dayName} ${due.getDate()}`;
  }
  return due.toLocaleDateString(lang, { month: "short", day: "numeric" });
}

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

const checkVariants = {
  unchecked: { scale: 1 },
  checked: { scale: [1, 1.3, 1], transition: { duration: 0.25 } },
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const { i18n } = useTranslation();
  const { toggleTask, deleteTask } = useTaskStore();
  const [deleting, setDeleting] = useState(false);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    await toggleTask(task.id);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await deleteTask(task.id);
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
      onClick={() => onClick(task)}
      whileHover={{ y: -2, boxShadow: "0 8px 25px -8px rgba(0,0,0,0.1)" }}
      className={`group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:cursor-pointer dark:border-gray-800 dark:bg-gray-900 ${
        task.isCompleted ? "opacity-60" : ""
      } ${task.priority < 4 ? "border-l-4" : ""}`}
      style={task.priority < 4 ? { borderLeftColor: priorityColors[task.priority] } : undefined}
    >
      <div className="flex h-6 items-center pt-0.5">
        <motion.button
          onClick={handleToggle}
          animate={task.isCompleted ? "checked" : "unchecked"}
          variants={checkVariants}
          whileTap={{ scale: 0.85 }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            task.isCompleted
              ? "border-primary bg-primary text-white"
              : "border-gray-300 hover:border-primary dark:border-gray-600"
          }`}
        >
          {task.isCompleted && (
            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              />
            </motion.svg>
          )}
        </motion.button>
      </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {task.status === "in_progress" && (
                <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 font-urbanist text-[9px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {i18n.language?.startsWith("es") ? "En curso" : "In progress"}
                </span>
              )}
              <h3
            className={`font-urbanist text-[15px] font-medium ${
              task.isCompleted
                ? "text-gray-400 line-through dark:text-gray-500"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {task.title}
          </h3>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
        )}

        {task.description && (
          <p className="mt-1 truncate font-urbanist text-xs text-gray-500 dark:text-gray-400">
            {task.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          {task.dueDate && (
            <span className={`font-urbanist text-xs ${
              isDueDateOverdue(task.dueDate) ? "text-red-500 font-medium" : "text-gray-400 dark:text-gray-500"
            }`}>
              {renderDueDate(task.dueDate, i18n.language)}
            </span>
          )}
          {task.subTasks && task.subTasks.length > 0 && (
            <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
              {task.subTasks.filter((st) => st.isCompleted).length}/{task.subTasks.length}
            </span>
          )}
        </div>
      </div>

      <motion.button
        onClick={handleDelete}
        disabled={deleting}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </motion.button>
    </motion.div>
  );
}
