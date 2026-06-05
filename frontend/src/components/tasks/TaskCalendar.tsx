import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import type { ExternalCalendarEvent } from "../../store/icsCalendarStore";

interface TaskCalendarProps {
  tasks: Task[];
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTaskClick: (task: Task) => void;
  listColors: Map<string, string>;
  externalEvents?: ExternalCalendarEvent[];
  onDayClick?: (date: Date) => void;
}

function normalizeDate(d: Date | string): string {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return d.split("T")[0];
}

function getDatePart(d: string): string {
  return d.split("T")[0];
}

export default function TaskCalendar({
  tasks,
  currentDate,
  onPrevMonth,
  onNextMonth,
  onTaskClick,
  listColors,
  externalEvents = [],
  onDayClick,
}: TaskCalendarProps) {
  const { t } = useTranslation();
  const dayHeaders = t("calendar.dayHeaders", { returnObjects: true }) as string[];
  const monthNames = t("calendar.monthNames", { returnObjects: true }) as string[];
  const maxVisible = 4;

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ExternalCalendarEvent[]>();
    for (const ev of externalEvents) {
      const dateKey = getDatePart(ev.startTime);
      const arr = map.get(dateKey) ?? [];
      arr.push(ev);
      map.set(dateKey, arr);
    }
    return map;
  }, [externalEvents]);

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

  function handleCellClick(e: React.MouseEvent, date: Date) {
    // Only trigger onDayClick if clicking the cell background, not a task/event
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-item]")) return;
    onDayClick?.(date);
  }

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
            const cellEvents = eventsByDate.get(cell.dateStr) ?? [];
            const cellTasks = tasksByDate.get(cell.dateStr) ?? [];
            const combined = [
              ...cellEvents.map((ev) => ({ kind: "event" as const, data: ev })),
              ...cellTasks.map((tk) => ({ kind: "task" as const, data: tk })),
            ];
            // Sort: events first by startTime, then tasks by priority
            combined.sort((a, b) => {
              if (a.kind === "event" && b.kind === "task") return -1;
              if (a.kind === "task" && b.kind === "event") return 1;
              if (a.kind === "event" && b.kind === "event") {
                const aEv = a.data as ExternalCalendarEvent;
                const bEv = b.data as ExternalCalendarEvent;
                return new Date(aEv.startTime).getTime() - new Date(bEv.startTime).getTime();
              }
              const aTk = a.data as Task;
              const bTk = b.data as Task;
              return (aTk.priority || 4) - (bTk.priority || 4);
            });
            const visible = combined.slice(0, maxVisible);
            const extra = combined.length - maxVisible;

            return (
              <div
                key={cell.dateStr}
                onClick={(e) => handleCellClick(e, cell.date)}
                className={`min-h-[90px] cursor-pointer border-b border-r border-gray-50 p-1.5 dark:border-gray-800/60
                  ${cell.isOtherMonth ? "bg-gray-50/50 dark:bg-gray-900/50" : ""}
                  ${cell.isToday ? "bg-primary/[0.03]" : ""}
                  hover:bg-gray-50/50 dark:hover:bg-gray-800/30`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-urbanist text-[11px] font-medium
                  ${cell.isToday ? "bg-primary text-white" : cell.isOtherMonth ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"}`}>
                  {cell.dayNum}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {visible.map((item) => {
                    if (item.kind === "event") {
                      const ev = item.data as ExternalCalendarEvent;
                      return (
                        <div
                          key={ev.id}
                          data-item="event"
                          className="flex items-center gap-1 truncate rounded px-1 py-0.5 font-urbanist text-[10px] font-medium leading-tight text-gray-700 dark:text-gray-300"
                          style={{
                            borderLeft: `3px solid ${ev.color}`,
                            backgroundColor: `${ev.color}10`,
                          }}
                          title={`${ev.title} (${ev.sourceName})`}
                        >
                          <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    }
                    const tk = item.data as Task;
                    return (
                      <button key={tk.id}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(tk); }}
                        className="w-full truncate rounded px-1 py-0.5 text-left font-urbanist text-[10px] font-medium leading-tight text-gray-700 transition-colors hover:brightness-110 dark:text-gray-300"
                        style={{
                          backgroundColor: tk.listId ? `${listColors.get(tk.listId) ?? "#6B7280"}18` : "#6B728018",
                          color: tk.listId ? (listColors.get(tk.listId) ?? "#6B7280") : "#6B7280",
                        }}
                        title={tk.title}>
                        {tk.title}
                      </button>
                    );
                  })}
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
