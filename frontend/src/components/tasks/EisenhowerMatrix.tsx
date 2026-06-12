import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import TaskCard from "./TaskCard";

interface EisenhowerMatrixProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const QUADRANTS = [
  { key: "do", labelKey: "do", color: "bg-red-50 ring-red-200 dark:bg-red-900/10 dark:ring-red-800", priorities: [1] },
  { key: "decide", labelKey: "decide", color: "bg-blue-50 ring-blue-200 dark:bg-blue-900/10 dark:ring-blue-800", priorities: [2] },
  { key: "delegate", labelKey: "delegate", color: "bg-amber-50 ring-amber-200 dark:bg-amber-900/10 dark:ring-amber-800", priorities: [3] },
  { key: "eliminate", labelKey: "eliminate", color: "bg-gray-50 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700", priorities: [4] },
];

export default function EisenhowerMatrix({ tasks, onTaskClick }: EisenhowerMatrixProps) {
  const { t } = useTranslation();

  const quadrantTasks = useMemo(() => {
    const active = tasks.filter((t) => !t.isCompleted);
    return {
      do: active.filter((t) => t.priority === 1),
      decide: active.filter((t) => t.priority === 2),
      delegate: active.filter((t) => t.priority === 3),
      eliminate: active.filter((t) => t.priority === 4),
    };
  }, [tasks]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {QUADRANTS.map((q) => {
        const items = quadrantTasks[q.key as keyof typeof quadrantTasks];
        return (
          <div key={q.key} className={`rounded-xl p-3 ring-1 ${q.color}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-outfit text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t(`matrix.${q.labelKey}`)}
              </h3>
              <span className="font-urbanist text-[10px] font-medium text-gray-400">{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.slice(0, 8).map((task) => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} />
              ))}
              {items.length > 8 && (
                <p className="text-center font-urbanist text-[10px] text-gray-400">
                  +{items.length - 8} more
                </p>
              )}
              {items.length === 0 && (
                <p className="py-4 text-center font-urbanist text-xs text-gray-400">
                  {t("matrix.empty")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
