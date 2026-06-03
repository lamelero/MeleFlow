import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import TaskCalendar from "../../components/tasks/TaskCalendar";
import TaskDetailPanel from "../../components/tasks/TaskDetailPanel";
import { useTaskStore, type Task } from "../../store/taskStore";
import { useListStore } from "../../store/listStore";

export default function CalendarView() {
  const { t } = useTranslation();
  const { tasks, fetchTasks } = useTaskStore();
  const { lists, fetchLists } = useListStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const listColors = new Map(lists.map((l) => [l.id, l.color]));

  const loadMonth = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const from = new Date(year, month, 1);
    from.setDate(from.getDate() - from.getDay());
    const to = new Date(year, month + 1, 0);
    to.setDate(to.getDate() + (6 - to.getDay()));
    fetchTasks({
      dueDateFrom: from.toISOString().split("T")[0],
      dueDateTo: to.toISOString().split("T")[0],
      status: "pending",
    });
  }, [fetchTasks]);

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

  return (
    <AppLayout title={t("calendar.title")}>
      <div className="mx-auto w-full max-w-6xl p-4">
        <TaskCalendar
          tasks={tasks}
          currentDate={currentDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onTaskClick={setSelectedTask}
          listColors={listColors}
        />
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </AppLayout>
  );
}
