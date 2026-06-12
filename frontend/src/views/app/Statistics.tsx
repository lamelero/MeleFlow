import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import { useTaskStore } from "../../store/taskStore";
import { useHabitStore } from "../../store/habitStore";

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Statistics() {
  const { t, i18n } = useTranslation();
  const { tasks } = useTaskStore();
  const { habits } = useHabitStore();
  const [period, setPeriod] = useState<"week" | "month">("week");

  const days = useMemo(() => {
    const names = i18n.language?.startsWith("es") ? DAYS_ES : DAYS_EN;
    const labels: string[] = [];
    const completed: number[] = [];
    const now = new Date();
    const count = period === "week" ? 7 : 30;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      labels.push(i % (count === 7 ? 1 : 5) === 0 ? `${names[d.getDay()]} ${d.getDate()}` : "");
      completed.push(tasks.filter((t) => t.isCompleted && t.updatedAt?.startsWith(dateStr)).length);
    }
    return { labels, completed };
  }, [tasks, period, i18n.language]);

  const maxCompleted = Math.max(...days.completed, 1);
  const totalCompleted = tasks.filter((t) => t.isCompleted).length;
  const totalPending = tasks.filter((t) => !t.isCompleted).length;

  const avgPerDay = useMemo(() => {
    const now = new Date();
    const daysBack = period === "week" ? 7 : 30;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    const done = tasks.filter((t) => t.isCompleted && new Date(t.updatedAt) >= cutoff);
    return (done.length / daysBack).toFixed(1);
  }, [tasks, period]);

  const habitRate = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const daysBack = period === "week" ? 7 : 30;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    const active = habits.filter((h) => !h.isArchived);
    if (active.length === 0) return 0;
    const expectedTotal = active.length * (period === "week" ? 7 : 30);
    let completedCount = 0;
    for (const h of active) {
      for (const log of h.logs) {
        if (log >= cutoff.toISOString().split("T")[0] && log <= todayStr) completedCount++;
      }
    }
    return expectedTotal > 0 ? Math.round((completedCount / expectedTotal) * 100) : 0;
  }, [habits, period]);

  return (
    <AppLayout title={t("statistics.title")}>
      <div className="mx-auto w-full max-w-2xl p-4">
        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium transition-all ${
                period === p
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {t(`statistics.${p}`)}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">{t("statistics.tasksDone")}</p>
            <p className="mt-1 font-outfit text-xl font-bold text-gray-900 dark:text-gray-100">{totalCompleted}</p>
            <p className="font-urbanist text-[10px] text-gray-400">{t("statistics.pending")}: {totalPending}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">{t("statistics.avgPerDay")}</p>
            <p className="mt-1 font-outfit text-xl font-bold text-gray-900 dark:text-gray-100">{avgPerDay}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="font-urbanist text-[11px] text-gray-400 dark:text-gray-500">{t("statistics.habitRate")}</p>
            <p className="mt-1 font-outfit text-xl font-bold text-teal-500">{habitRate}%</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("statistics.tasksPerDay")}
          </h3>
          <div className="flex items-end gap-0.5" style={{ height: 120 }}>
            {days.completed.map((val, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-urbanist text-[9px] text-gray-400">{val || ""}</span>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: `${Math.max((val / maxCompleted) * 100, 2)}%`, backgroundColor: val > 0 ? "#14B8A6" : "#e5e7eb" }}
                />
                {days.labels[i] && (
                  <span className="mt-1 whitespace-nowrap font-urbanist text-[8px] text-gray-400">{days.labels[i]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
