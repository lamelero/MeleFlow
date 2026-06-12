import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import TaskCard from "./TaskCard";
import type { FilterPreset } from "./TaskFilters";

interface KanbanViewProps {
  tasks: Task[];
  filter?: { listId?: string; tagId?: string; preset?: FilterPreset };
  onTaskClick: (task: Task) => void;
}

const COLUMNS = [
  { id: "pending", label: "pending", color: "bg-amber-50 ring-amber-200 dark:bg-amber-900/10 dark:ring-amber-800" },
  { id: "in_progress", label: "inProgress", color: "bg-blue-50 ring-blue-200 dark:bg-blue-900/10 dark:ring-blue-800" },
  { id: "completed", label: "completed", color: "bg-emerald-50 ring-emerald-200 dark:bg-emerald-900/10 dark:ring-emerald-800" },
];

export default function KanbanView({ tasks, filter, onTaskClick }: KanbanViewProps) {
  const { t } = useTranslation();
  const { updateTask } = useTaskStore();

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    if (filter?.listId) filtered = filtered.filter((t) => t.listId === filter.listId);
    if (filter?.tagId && filtered[0]?.tags) {
      filtered = filtered.filter((t) => t.tags?.some((tag) => tag.id === filter?.tagId));
    }
    if (filter?.preset === "today") {
      const today = new Date().toISOString().split("T")[0];
      filtered = filtered.filter((t) => t.dueDate?.split("T")[0] === today);
    }
    if (filter?.preset === "overdue") {
      const today = new Date().toISOString().split("T")[0];
      filtered = filtered.filter((t) => t.dueDate && t.dueDate.split("T")[0] < today && !t.isCompleted);
    }
    return filtered;
  }, [tasks, filter]);

  const columnTasks = useMemo(() => ({
    pending: filteredTasks.filter((t) => t.status === "todo" || (t.status === undefined && !t.isCompleted)),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress" && !t.isCompleted),
    completed: filteredTasks.filter((t) => t.status === "completed" || t.isCompleted),
  }), [filteredTasks]);

  function handleDropColumn(taskId: string, colId: string) {
    if (colId === "pending") updateTask(taskId, { status: "todo", isCompleted: false });
    else if (colId === "in_progress") updateTask(taskId, { status: "in_progress", isCompleted: false });
    else if (colId === "completed") updateTask(taskId, { status: "completed", isCompleted: true });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, colId: string) {
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) handleDropColumn(taskId, colId);
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {COLUMNS.map((col) => {
        const items = columnTasks[col.id as keyof typeof columnTasks];
        return (
          <div
            key={col.id}
            className={`rounded-xl p-3 ring-1 ${col.color}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <h3 className="mb-3 font-outfit text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t(`kanban.${col.label}`)} ({items.length})
            </h3>
            <div className="space-y-2">
              {items.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                >
                  <TaskCard task={task} onClick={onTaskClick} />
                </div>
              ))}
              {items.length === 0 && (
                <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-4 dark:border-gray-700" style={{ minHeight: 60 }}>
                  <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                    {t("kanban.dropHere")}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
