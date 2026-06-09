import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const EMOJIS = [
  "📝", "🛒", "💼", "🏠", "💪", "📚", "🎵", "✈️",
  "🎮", "💻", "🏋️", "🎨", "🛠️", "📅", "⭐", "🔥",
  "💡", "🎯", "🏆", "📦", "🎁", "🏖️", "🚗", "🍳",
  "💰", "🎓", "🌱", "🐾", "❤️", "🎬",
];

interface EmojiPickerProps {
  selected: string | null;
  onSelect: (emoji: string | null) => void;
}

export default function EmojiPicker({ selected, onSelect }: EmojiPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-base transition-colors hover:border-primary dark:border-gray-600"
      >
        {selected || "😀"}
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
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onSelect(emoji); setOpen(false); }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selected === emoji ? "bg-primary/10 ring-2 ring-primary" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
