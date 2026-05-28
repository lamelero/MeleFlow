interface HabitGridProps {
  logs: string[];
  color?: string;
  weeks?: number;
}

export default function HabitGrid({
  logs,
  color = "#14B8A6",
  weeks = 12,
}: HabitGridProps) {
  const totalDays = weeks * 7;
  const today = new Date();

  const days = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (totalDays - 1 - i));
    const dateStr = date.toISOString().split("T")[0];
    return {
      date: dateStr,
      completed: logs.includes(dateStr),
    };
  });

  const weeksGrid: typeof days[] = [];
  for (let w = 0; w < weeks; w++) {
    weeksGrid.push(days.slice(w * 7, (w + 1) * 7));
  }

  return (
    <div className="flex gap-0.5">
      {weeksGrid.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-0.5">
          {week.map((day) => (
            <div
              key={day.date}
              title={`${day.date}${day.completed ? " ✓" : ""}`}
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: day.completed ? color : "#E5E7EB",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
