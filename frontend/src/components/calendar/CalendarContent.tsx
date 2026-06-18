import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import TaskCalendar from "../tasks/TaskCalendar";
import AgendaView from "../tasks/AgendaView";
import TaskDetailPanel from "../tasks/TaskDetailPanel";
import EventDetailModal from "../tasks/EventDetailModal";
import { useTaskStore, type Task } from "../../store/taskStore";
import { useListStore } from "../../store/listStore";
import { useIcsCalendarStore, type ExternalCalendarEvent } from "../../store/icsCalendarStore";
import { client } from "../../api/client";

const HIDDEN_CALENDARS_KEY = "hiddenCalendarIds";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

interface CalendarContentProps {
  standalone?: boolean;
}

export default function CalendarContent({ standalone = true }: CalendarContentProps) {
  const { t } = useTranslation();
  const { tasks, fetchTasks, createTask } = useTaskStore();
  const { lists, fetchLists } = useListStore();
  const { events: icsEvents, fetchEvents, calendars: icsCalendars, fetchCalendars } = useIcsCalendarStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ExternalCalendarEvent | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [viewMode, setViewMode] = useState<"agenda" | "grid">(isDesktop ? "grid" : "agenda");
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_CALENDARS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [calPickerOpen, setCalPickerOpen] = useState(false);
  const calPickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<({ type: "task"; data: Task } | { type: "event"; data: ExternalCalendarEvent })[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setViewMode(isDesktop ? "grid" : "agenda");
  }, [isDesktop]);

  useEffect(() => {
    if (icsCalendars.length === 0) fetchCalendars();
  }, [fetchCalendars, icsCalendars.length]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calPickerRef.current && !calPickerRef.current.contains(e.target as Node)) {
        setCalPickerOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node) && searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    if (calPickerOpen || searchResults.length > 0) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [calPickerOpen, searchResults.length]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const localTaskResults = tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({ type: "task" as const, data: t }));
    setSearchLoading(true);
    setSearchResults(localTaskResults);
    const timer = setTimeout(async () => {
      try {
        const [icsRes, tasksRes] = await Promise.all([
          client.get(`/ics-calendars/search?q=${encodeURIComponent(searchQuery)}`),
          client.get(`/tasks/search?q=${encodeURIComponent(searchQuery)}`),
        ]);
        const seenIds = new Set(localTaskResults.map((r) => r.data.id));
        const apiTaskResults = (tasksRes.data as Task[])
          .filter((t: Task) => !seenIds.has(t.id))
          .map((t: Task) => ({ type: "task" as const, data: t }));
        setSearchResults([
          ...localTaskResults,
          ...apiTaskResults,
          ...(icsRes.data as ExternalCalendarEvent[]).map((e) => ({ type: "event" as const, data: e })),
        ]);
      } catch {
        // silent
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, tasks]);

  const [isCreating, setIsCreating] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const listColors = new Map(lists.map((l) => [l.id, l.color]));

  const loadMonth = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const from = new Date(year, month, 1);
    from.setDate(from.getDate() - from.getDay());
    const to = new Date(year, month + 1, 0);
    to.setDate(to.getDate() + (6 - to.getDay()));
    const fromStr = from.toISOString();
    const toStr = to.toISOString();
    fetchTasks({
      dueDateFrom: from.toISOString().split("T")[0],
      dueDateTo: to.toISOString().split("T")[0],
      status: "pending",
    });
    fetchEvents(fromStr, toStr);
  }, [fetchTasks, fetchEvents]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    loadMonth(currentDate);
  }, [currentDate, loadMonth, viewMode]);

  // Retry load on mount for WebView timing
  const loadRef = useRef(loadMonth);
  loadRef.current = loadMonth;
  const dateRef = useRef(currentDate);
  dateRef.current = currentDate;
  useEffect(() => {
    const delays = [200, 500];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const d of delays) {
      timers.push(setTimeout(() => loadRef.current(dateRef.current), d));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  function handlePrevMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function toggleCalendar(id: string) {
    setHiddenCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(HIDDEN_CALENDARS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const visibleEvents = icsEvents.filter((e) => !hiddenCalendarIds.has(e.icsCalendarId));
  const totalCalWithEvents = new Set(icsEvents.map((e) => e.icsCalendarId)).size;
  const visibleCalCount = totalCalWithEvents - hiddenCalendarIds.size;

  function handleDayClick(date: Date) {
    setNewTaskDate(date);
    setNewTaskTitle("");
    setIsCreating(true);
  }

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskDate) return;
    try {
      await createTask({
        title: newTaskTitle.trim(),
        dueDate: newTaskDate.toISOString(),
      });
      toast.success(t("calendar.createSuccess") || "Task created");
      setIsCreating(false);
      setNewTaskTitle("");
      setNewTaskDate(null);
      loadMonth(currentDate);
    } catch {
      toast.error(t("calendar.createFailed") || "Failed to create task");
    }
  }

  const content = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs" ref={searchRef}>
          <div className="relative">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setSearchResults([]); } }}
              placeholder={t("calendar.search") || "Search tasks and events..."}
              className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-8 font-urbanist text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults([]); searchInputRef.current?.focus(); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {searchResults.map((r, i) => (
                    <button
                      key={`${r.type}-${r.type === "task" ? r.data.id : r.data.id}`}
                      onClick={() => {
                        if (r.type === "task") setSelectedTask(r.data);
                        else setSelectedEvent(r.data);
                        setSearchResults([]);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="shrink-0">
                        {r.type === "task" ? (
                          <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        ) : (
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: (r.data as ExternalCalendarEvent).color }} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-urbanist text-xs font-medium text-gray-700 dark:text-gray-300">{r.data.title}</p>
                        <p className="font-urbanist text-[10px] text-gray-400 dark:text-gray-500">
                          {r.type === "event"
                            ? new Date((r.data as ExternalCalendarEvent).startTime).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
                            : (r.data as Task).dueDate
                              ? new Date((r.data as Task).dueDate!).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
                              : "—"}
                        </p>
                      </div>
                      <span className="shrink-0 font-urbanist text-[10px] text-gray-400">
                        {r.type === "event" ? (r.data as ExternalCalendarEvent).sourceName : t("dashboard.todo")}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {icsCalendars.length > 0 && (
          <div className="relative" ref={calPickerRef}>
            <button
              onClick={() => setCalPickerOpen(!calPickerOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {visibleCalCount}/{icsCalendars.length}
            </button>

            <AnimatePresence>
              {calPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="p-1.5">
                    {icsCalendars.map((cal) => {
                      const isHidden = hiddenCalendarIds.has(cal.id);
                      return (
                        <button
                          key={cal.id}
                          onClick={() => toggleCalendar(cal.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-urbanist text-xs transition-colors ${
                            isHidden
                              ? "text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-gray-700"
                              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isHidden
                              ? "border-gray-300 dark:border-gray-600"
                              : "border-primary bg-primary text-white"
                          }`}>
                            {!isHidden && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
                          <span className="truncate">{cal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setViewMode("agenda")}
            className={`rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium transition-colors ${
              viewMode === "agenda"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {t("calendar.agenda")}
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {t("calendar.grid")}
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <TaskCalendar
          tasks={tasks}
          currentDate={currentDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTaskClick={setSelectedTask}
          onEventClick={setSelectedEvent}
          listColors={listColors}
          externalEvents={visibleEvents}
          onDayClick={handleDayClick}
        />
      ) : (
        <AgendaView
          tasks={tasks}
          currentDate={currentDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTaskClick={setSelectedTask}
          onEventClick={setSelectedEvent}
          listColors={listColors}
          externalEvents={visibleEvents}
        />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => setIsCreating(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("calendar.createTask")}
              </h3>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={t("calendar.taskTitlePlaceholder")}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTask();
                  if (e.key === "Escape") setIsCreating(false);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <p className="mt-2 font-urbanist text-xs text-gray-400 dark:text-gray-500">
                {t("calendar.taskTitle")}: {newTaskDate?.toLocaleDateString()}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim()}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("calendar.createTask")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (standalone) {
    return (
      <div className="mx-auto w-full max-w-6xl p-4">
        {content}
      </div>
    );
  }

  return content;
}
