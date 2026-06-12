import { useTranslation } from "react-i18next";

export type FilterPreset = "all" | "today" | "week" | "overdue" | "noDate";

interface TaskFiltersProps {
  active: FilterPreset;
  onChange: (preset: FilterPreset) => void;
}

const FILTERS: FilterPreset[] = ["all", "today", "week", "overdue", "noDate"];

export default function TaskFilters({ active, onChange }: TaskFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`rounded-lg px-2.5 py-1 font-urbanist text-xs font-medium transition-all ${
            active === f
              ? "bg-primary text-white shadow-sm"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
        >
          {t(`filters.${f}`)}
        </button>
      ))}
    </div>
  );
}
