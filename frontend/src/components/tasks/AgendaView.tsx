import { useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../store/taskStore";
import type { ExternalCalendarEvent } from "../../store/icsCalendarStore";

interface AgendaViewProps {
  tasks: Task[];
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTaskClick: (task: Task) => void;
  onEventClick?: (event: ExternalCalendarEvent) => void;
  listColors: Map<string, string>;
  externalEvents?: ExternalCalendarEvent[];
}

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AgendaView({
  tasks,
  currentDate,
  onPrevMonth,
  onNextMonth,
  onTaskClick,
  onEventClick,
  listColors,
  externalEvents = [],
}: AgendaViewProps) {
  const { t } = useTranslation();
  const monthNames = t("calendar.monthNames", { returnObjects: true }) as string[];
  const dayHeaders = t("calendar.dayHeaders", { returnObjects: true }) as string[];

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getDateStr(new Date());

    const tasksByDate = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = task.dueDate.split("T")[0];
      const arr = tasksByDate.get(key) ?? [];
      arr.push(task);
      tasksByDate.set(key, arr);
    }

    const eventsByDate = new Map<string, ExternalCalendarEvent[]>();
    for (const ev of externalEvents) {
      const key = ev.startTime.split("T")[0];
      const arr = eventsByDate.get(key) ?? [];
      arr.push(ev);
      eventsByDate.set(key, arr);
    }

    const result: {
      date: Date;
      dateStr: string;
      dayNum: number;
      isToday: boolean;
      dayName: string;
      tasks: Task[];
      events: ExternalCalendarEvent[];
    }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = getDateStr(d);
      result.push({
        date: d,
        dateStr,
        dayNum: day,
        isToday: dateStr === todayStr,
        dayName: dayHeaders[d.getDay() === 0 ? 6 : d.getDay() - 1] || dayHeaders[d.getDay()],
        tasks: tasksByDate.get(dateStr) ?? [],
        events: eventsByDate.get(dateStr) ?? [],
      });
    }

    return result;
  }, [tasks, externalEvents, currentDate, dayHeaders]);

  useEffect(() => {
    const el = document.getElementById("agenda-today");
    if (!el) return;
    const delays = [100, 200, 400, 800, 1000];
    let timer: ReturnType<typeof setTimeout>;
    function tryScroll(i: number) {
      el!.scrollIntoView({ behavior: "smooth", block: "start" });
      if (i < delays.length - 1) {
        timer = setTimeout(() => tryScroll(i + 1), delays[i + 1]);
      }
    }
    timer = setTimeout(() => tryScroll(0), delays[0]);
    return () => clearTimeout(timer);
  }, [currentDate]);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
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

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {days.map((day) => {
          const hasItems = day.tasks.length > 0 || day.events.length > 0;
          return (
            <div key={day.dateStr} id={day.isToday ? "agenda-today" : undefined} className={`px-4 py-3 ${day.isToday ? "bg-primary/[0.02]" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-urbanist text-xs font-medium ${
                  day.isToday ? "bg-primary text-white" : "text-gray-500 dark:text-gray-400"
                }`}>
                  {day.dayNum}
                </span>
                <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                  {day.dayName}
                </span>
                {day.isToday && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-urbanist text-[10px] font-medium text-primary">
                    {t("calendar.today")}
                  </span>
                )}
              </div>

              {!hasItems && (
                <p className="ml-9 font-urbanist text-xs text-gray-300 dark:text-gray-600">
                  {t("calendar.noTasks")}
                </p>
              )}

              <div className="ml-9 space-y-1">
                {day.events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ev.color }} />
                    <span className="min-w-[48px] font-urbanist text-xs text-gray-400 dark:text-gray-500">
                      {ev.isAllDay
                        ? t("calendar.allDay")
                        : new Date(ev.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex-1 truncate font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                      {ev.title}
                    </span>
                    <span className="shrink-0 font-urbanist text-[10px] text-gray-400 dark:text-gray-500">
                      {ev.sourceName}
                    </span>
                  </button>
                ))}

                {[...day.tasks].sort((a, b) => {
                  const aTime = a.dueDate && !a.dueDate.endsWith("T00:00:00.000Z") ? new Date(a.dueDate).getTime() : 9999999999999;
                  const bTime = b.dueDate && !b.dueDate.endsWith("T00:00:00.000Z") ? new Date(b.dueDate).getTime() : 9999999999999;
                  return aTime - bTime;
                }).map((tk) => (
                  <button
                    key={tk.id}
                    onClick={() => onTaskClick(tk)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tk.listId ? (listColors.get(tk.listId) ?? "#6B7280") : "#6B7280" }}
                    />
                    <span className="min-w-[48px] font-urbanist text-xs text-gray-400 dark:text-gray-500">
                      {tk.dueDate && !tk.dueDate.endsWith("T00:00:00.000Z")
                        ? new Date(tk.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : tk.dueDate ? "📅" : ""}
                    </span>
                    <span className="flex-1 truncate font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tk.title}
                    </span>
                    {tk.priority !== undefined && tk.priority <= 2 && (
                      <span className="shrink-0 text-red-400">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9l3-3m0 0l3 3m-3-3v8" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
