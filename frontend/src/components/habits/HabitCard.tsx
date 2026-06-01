import type { Habit } from "../../store/habitStore";
import { useHabitStore } from "../../store/habitStore";
import HabitGrid from "./HabitGrid";

export default function HabitCard({ habit }: { habit: Habit }) {
  const { checkIn } = useHabitStore();

  const today = new Date().toISOString().split("T")[0];
  const checkedToday = habit.logs.includes(today);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: habit.color }}
          />
          <h3 className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
            {habit.name}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
            🔥 {habit.streakCount} day{habit.streakCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => checkIn(habit.id)}
            disabled={checkedToday}
            className={`rounded-lg px-3 py-1 font-urbanist text-xs font-medium transition-colors ${
              checkedToday
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20"
            }`}
          >
            {checkedToday ? "Done ✓" : "Check in"}
          </button>
        </div>
      </div>
      <HabitGrid logs={habit.logs} color={habit.color} />
    </div>
  );
}
