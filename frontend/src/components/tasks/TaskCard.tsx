import { useState } from "react";
import { motion } from "framer-motion";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TagPill from "../tags/TagPill";

const priorityColors: Record<number, string> = {
  1: "bg-[#EF4444]",
  2: "bg-[#F59E0B]",
  3: "bg-[#3B82F6]",
  4: "bg-[#9CA3AF]",
};

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
      }`}
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
          <motion.span
            animate={{ scale: task.priority <= 2 ? [1, 1.2, 1] : 1 }}
            transition={{ repeat: task.priority <= 2 ? Infinity : 0, repeatDelay: 2, duration: 0.6 }}
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${priorityColors[task.priority] || priorityColors[4]}`}
          />
          <h3
            className={`font-urbanist text-sm font-medium ${
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
            <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
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
