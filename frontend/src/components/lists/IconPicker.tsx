import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LIST_ICONS, type ListIconDef } from "./listIcons";

interface IconPickerProps {
  selected: string | null;
  onSelect: (name: string | null) => void;
  color?: string;
}

export default function IconPicker({ selected, onSelect, color }: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedDef = LIST_ICONS.find((i) => i.name === selected);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-primary dark:border-gray-600 dark:text-gray-400"
      >
        {selectedDef ? (
          <span style={color ? { color } : undefined}>
            <selectedDef.icon className="h-4 w-4" />
          </span>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[272px] rounded-xl border bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="font-urbanist text-xs text-gray-400">{t("dashboard.icon")}</span>
            {selected && (
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false); }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {t("dashboard.removeIcon")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {LIST_ICONS.map((def) => (
              <button
                key={def.name}
                type="button"
                onClick={() => { onSelect(def.name); setOpen(false); }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 ${
                  selected === def.name ? "bg-primary/10 text-primary ring-2 ring-primary" : ""
                }`}
              >
                <def.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
