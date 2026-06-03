import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";

interface TaskCalendarProps {
  tasks: Task[];
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTaskClick: (task: Task) => void;
  listColors: Map<string, string>;
}

function normalizeDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TaskCalendar({ tasks, currentDate, onPrevMonth, onNextMonth, onTaskClick, listColors }: TaskCalendarProps) {
  const { t } = useTranslation();
  const dayHeaders = t("calendar.dayHeaders", { returnObjects: true }) as string[];
  const monthNames = t("calendar.monthNames", { returnObjects: true }) as string[];
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateKey = task.dueDate.split("T")[0];
      const arr = map.get(dateKey) ?? [];
      arr.push(task);
      map.set(dateKey, arr);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDow = firstDay.getDay();
    const startOffset = startDow === 0 ? 6 : startDow - 1;
    const todayStr = normalizeDate(new Date());
    const currentMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

    const rows: { date: Date; dateStr: string; dayNum: number; isToday: boolean; isOtherMonth: boolean }[][] = [];
    let row: typeof rows[number] = [];

    // Pad from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      row.push({ date: d, dateStr: normalizeDate(d), dayNum: d.getDate(), isToday: false, isOtherMonth: true });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = normalizeDate(d);
      row.push({ date: d, dateStr, dayNum: day, isToday: dateStr === todayStr, isOtherMonth: false });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }

    // Pad to next month
    if (row.length > 0) {
      let nextDay = 1;
      while (row.length < 7) {
        const d = new Date(year, month + 1, nextDay++);
        row.push({ date: d, dateStr: normalizeDate(d), dayNum: d.getDate(), isToday: false, isOtherMonth: true });
      }
      rows.push(row);
    }

    return rows;
  }, [currentDate]);

  const maxVisible = 3;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      {/* Navigation header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
        <h2 className="font-outfit text-base font-semibold text-gray-900 dark:text-gray-100">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={onNextMonth}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {dayHeaders.map((label) => (
          <div key={label}
            className="py-2 text-center font-urbanist text-xs font-medium text-gray-400 dark:text-gray-500">
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {grid.map((row, ri) =>
          row.map((cell) => {
            const cellTasks = tasksByDate.get(cell.dateStr) ?? [];
            const visible = cellTasks.slice(0, maxVisible);
            const extra = cellTasks.length - maxVisible;

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[90px] border-b border-r border-gray-50 p-1.5 dark:border-gray-800/60
                  ${cell.isOtherMonth ? "bg-gray-50/50 dark:bg-gray-900/50" : ""}
                  ${cell.isToday ? "bg-primary/[0.03]" : ""}`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-urbanist text-[11px] font-medium
                  ${cell.isToday ? "bg-primary text-white" : cell.isOtherMonth ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"}`}>
                  {cell.dayNum}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {visible.map((task) => (
                    <button key={task.id}
                      onClick={() => onTaskClick(task)}
                      className="w-full truncate rounded px-1 py-0.5 text-left font-urbanist text-[10px] font-medium leading-tight text-gray-700 transition-colors hover:brightness-110 dark:text-gray-300"
                      style={{
                        backgroundColor: task.listId ? `${listColors.get(task.listId) ?? "#6B7280"}18` : "#6B728018",
                        color: task.listId ? (listColors.get(task.listId) ?? "#6B7280") : "#6B7280",
                      }}
                      title={task.title}>
                      {task.title}
                    </button>
                  ))}
                  {extra > 0 && (
                    <span className="block truncate px-1 font-urbanist text-[10px] font-medium text-gray-400 dark:text-gray-500">
                      {t("calendar.more", { count: extra })}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
