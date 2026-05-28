import { useState } from "react";
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
    <div
      onClick={() => onClick(task)}
      className={`group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:cursor-pointer hover:shadow-md ${
        task.isCompleted ? "opacity-60" : ""
      }`}
    >
      <div className="flex h-6 items-center pt-0.5">
        <button
          onClick={handleToggle}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            task.isCompleted
              ? "border-primary bg-primary text-white"
              : "border-gray-300 hover:border-primary"
          }`}
        >
          {task.isCompleted && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${priorityColors[task.priority] || priorityColors[4]}`}
          />
          <h3
            className={`font-urbanist text-sm font-medium ${
              task.isCompleted
                ? "text-gray-400 line-through"
                : "text-gray-900"
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
          <p className="mt-1 truncate font-urbanist text-xs text-gray-500">
            {task.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          {task.dueDate && (
            <span className="font-urbanist text-xs text-gray-400">
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {task.subTasks && task.subTasks.length > 0 && (
            <span className="font-urbanist text-xs text-gray-400">
              {task.subTasks.filter((st) => st.isCompleted).length}/{task.subTasks.length}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
