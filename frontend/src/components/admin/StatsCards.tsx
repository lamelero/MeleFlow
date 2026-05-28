import type { AdminStats } from "../../store/adminStore";

interface StatsCardsProps {
  stats: AdminStats | null;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null;

  const cards = [
    { label: "Users", value: stats.totalUsers, color: "bg-blue-500" },
    { label: "Tasks", value: stats.totalTasks, color: "bg-teal-500" },
    { label: "Completed", value: stats.completedTasks, color: "bg-green-500" },
    { label: "Completion", value: `${stats.completionRate}%`, color: "bg-amber-500" },
    { label: "Lists", value: stats.totalLists, color: "bg-purple-500" },
    { label: "Habits", value: stats.totalHabits, color: "bg-pink-500" },
    { label: "Pomodoros", value: stats.totalPomodoros, color: "bg-orange-500" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${card.color}`} />
            <span className="font-urbanist text-sm text-gray-500">
              {card.label}
            </span>
          </div>
          <p className="mt-2 font-outfit text-2xl font-bold text-gray-900">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
