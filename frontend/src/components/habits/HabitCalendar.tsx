import { useMemo } from "react";

interface HabitCalendarProps {
  logs: string[];
  weeks?: number;
  onCellClick?: (dateStr: string) => void;
}

const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

interface Cell {
  dateStr: string;
  dayNum: number;
  isToday: boolean;
  isFuture: boolean;
}

type Row = Cell[];

export default function HabitCalendar({ logs, weeks = 5, onCellClick }: HabitCalendarProps) {
  const logSet = useMemo(() => new Set(logs), [logs]);

  const { rows, monthRows } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const start = new Date(today);
    start.setDate(start.getDate() - weeks * 7);
    const dow = start.getDay();
    start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));

    const allRows: Row[] = [];
    let current = new Date(start);

    while (true) {
      const row: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split("T")[0];
        const isFuture = current > today;
        row.push({
          dateStr,
          dayNum: current.getDate(),
          isToday: !isFuture && dateStr === todayStr,
          isFuture,
        });
        current.setDate(current.getDate() + 1);
      }
      allRows.push(row);
      if (row.every((c) => c.isFuture)) break;
    }
    allRows.pop();

    const mRows = new Set<number>();
    for (let i = 0; i < allRows.length; i++) {
      const first = allRows[i].find((c) => !c.isFuture);
      if (!first) continue;
      const m = new Date(first.dateStr + "T00:00:00").getMonth();
      if (i === 0) { mRows.add(i); continue; }
      const prevFirst = allRows[i - 1].find((c) => !c.isFuture);
      if (prevFirst && new Date(prevFirst.dateStr + "T00:00:00").getMonth() !== m) {
        mRows.add(i);
      }
    }

    return { rows: allRows, monthRows: mRows };
  }, [weeks]);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-px">
        {/* Header */}
        <div className="flex items-center">
          <div className="w-5 shrink-0" />
          {DAY_HEADERS.map((label) => (
            <div
              key={label}
              className="flex h-6 w-7 items-center justify-center font-urbanist text-[10px] font-medium text-gray-400 dark:text-gray-500"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row, ri) => {
          const showMonth = monthRows.has(ri);
          const firstReal = row.find((c) => !c.isFuture);
          const monthLabel = showMonth && firstReal
            ? MONTHS[new Date(firstReal.dateStr + "T00:00:00").getMonth()]
            : "";

          return (
            <div key={ri} className="flex items-center">
              <div className="flex w-5 shrink-0 items-center justify-start font-urbanist text-[9px] font-medium text-gray-400 dark:text-gray-500">
                {monthLabel}
              </div>
              {row.map((cell) => {
                const logged = logSet.has(cell.dateStr);
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    disabled={cell.isFuture}
                    onClick={() => onCellClick?.(cell.dateStr)}
                    className={`flex h-7 w-7 items-center justify-center rounded font-urbanist text-[11px] font-medium transition-all
                      ${cell.isFuture ? "cursor-default opacity-15" : "cursor-pointer"}
                      ${
                        logged
                          ? "bg-primary text-white hover:bg-primary/80"
                          : cell.isToday
                            ? "bg-gray-100 text-gray-600 ring-1 ring-primary/50 dark:bg-gray-800 dark:text-gray-300"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
