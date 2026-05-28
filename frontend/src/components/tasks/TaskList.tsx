import { useEffect } from "react";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TaskCard from "./TaskCard";

interface TaskListProps {
  filter?: {
    listId?: string;
    status?: "completed" | "pending";
  };
  emptyMessage?: string;
  onTaskClick: (task: Task) => void;
}

export default function TaskList({
  filter,
  emptyMessage = "No tasks yet",
  onTaskClick,
}: TaskListProps) {
  const { tasks, isLoading, error, fetchTasks } = useTaskStore();

  useEffect(() => {
    fetchTasks(filter);
  }, [filter?.listId, filter?.status, fetchTasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
        <p className="font-urbanist text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task: Task) => (
        <TaskCard key={task.id} task={task} onClick={onTaskClick} />
      ))}
    </div>
  );
}
