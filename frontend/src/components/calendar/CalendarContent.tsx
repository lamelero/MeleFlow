import { useEffect, useState, useCallback } from "react";
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
  const { events: icsEvents, fetchEvents } = useIcsCalendarStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ExternalCalendarEvent | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [viewMode, setViewMode] = useState<"agenda" | "grid">(isDesktop ? "grid" : "agenda");

  useEffect(() => {
    setViewMode(isDesktop ? "grid" : "agenda");
  }, [isDesktop]);

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
  }, [currentDate, loadMonth]);

  function handlePrevMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

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
      <div className="mb-3 flex items-center justify-end gap-2">
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

      {viewMode === "grid" ? (
        <TaskCalendar
          tasks={tasks}
          currentDate={currentDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTaskClick={setSelectedTask}
          onEventClick={setSelectedEvent}
          listColors={listColors}
          externalEvents={icsEvents}
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
          externalEvents={icsEvents}
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
