import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

export type FilterPreset = "all" | "today" | "week" | "overdue" | "noDate";

interface TaskFiltersProps {
  active: FilterPreset;
  onChange: (preset: FilterPreset) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
}

const FILTERS: FilterPreset[] = ["all", "today", "week", "overdue", "noDate"];

export default function TaskFilters({ active, onChange, showCompleted, onToggleCompleted }: TaskFiltersProps) {
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
      <button
        onClick={onToggleCompleted}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-urbanist text-xs font-medium transition-all ${
          showCompleted
            ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
        }`}
      >
        {showCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {showCompleted ? t("filters.hideCompleted") : t("filters.showCompleted")}
      </button>
    </div>
  );
}
