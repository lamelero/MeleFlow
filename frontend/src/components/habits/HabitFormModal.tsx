import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { HABIT_CATEGORIES, HABIT_CATEGORY_KEYS } from "../../lib/habit-categories";
import type { Habit } from "../../store/habitStore";
import { useHabitCategoryStore } from "../../store/habitCategoryStore";
import { LIST_ICONS } from "../lists/listIcons";

interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string | null;
    category: string;
    priority: number;
    frequency: string | null;
    startDate?: string;
    endDate?: string | null;
    categoryId?: string | null;
  }) => Promise<void>;
  habit?: Habit | null;
}

function parseFrequency(freq: string | null): {
  type: "daily" | "weekly" | "monthly";
  days: number[];
  reminderTime: string;
} {
  if (!freq) return { type: "daily", days: [], reminderTime: "" };
  try {
    const p = JSON.parse(freq);
    return {
      type: p.type || "daily",
      days: p.days || [],
      reminderTime: p.reminderTime || "",
    };
  } catch {
    return { type: "daily", days: [], reminderTime: "" };
  }
}

export default function HabitFormModal({
  isOpen,
  onClose,
  onSave,
  habit,
}: HabitFormModalProps) {
  const { t } = useTranslation();
  const { categories: dynamicCats } = useHabitCategoryStore();
  const dayHeaders = t("calendar.dayHeaders", { returnObjects: true }) as string[];
  const WEEK_DAYS = [
    { value: 1, label: dayHeaders[0] },
    { value: 2, label: dayHeaders[1] },
    { value: 3, label: dayHeaders[2] },
    { value: 4, label: dayHeaders[3] },
    { value: 5, label: dayHeaders[4] },
    { value: 6, label: dayHeaders[5] },
    { value: 0, label: dayHeaders[6] },
  ];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTROS");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState(1);
  const [freqType, setFreqType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [reminderTime, setReminderTime] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description || "");
      setCategory(habit.category);
      setCategoryId(habit.categoryId ?? null);
      setPriority(habit.priority);
      const freq = parseFrequency(habit.frequency);
      setFreqType(freq.type);
      setSelectedDays(freq.days);
      setReminderTime(freq.reminderTime);
      setStartDate(habit.startDate?.split("T")[0] || new Date().toISOString().split("T")[0]);
      setEndDate(habit.endDate?.split("T")[0] || "");
    } else {
      setName("");
      setDescription("");
      setCategory("OTROS");
      setCategoryId(null);
      setPriority(1);
      setFreqType("daily");
      setSelectedDays([]);
      setReminderTime("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
    }
  }, [habit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    let frequency: string | null = null;
    if (freqType !== "daily" || selectedDays.length > 0 || reminderTime) {
      const freqObj: Record<string, unknown> = { type: freqType };
      if (freqType === "weekly" && selectedDays.length > 0) {
        freqObj.days = selectedDays;
      }
      if (reminderTime) {
        freqObj.reminderTime = reminderTime;
      }
      frequency = JSON.stringify(freqObj);
    }

    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      category,
      priority,
      frequency,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      categoryId,
    });

    setSaving(false);
    onClose();
  }

  const catInfo = HABIT_CATEGORIES[category];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white/97 p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900/97 max-h-[85vh] overflow-y-auto">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-outfit text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {habit ? t("habits.editHabit") : t("habits.newHabit")}
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l10 10M14 4L4 14" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.name")}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("habits.namePlaceholder")}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.category")}
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                      {HABIT_CATEGORY_KEYS.map((key) => {
                        const info = HABIT_CATEGORIES[key];
                        const isActive = category === key && !categoryId;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => { setCategory(key); setCategoryId(null); }}
                            className="flex flex-col items-center gap-1 rounded-xl p-2 transition-all"
                            style={{
                              backgroundColor: isActive ? info.bgColor : "transparent",
                              border: isActive ? `2px solid ${info.color}` : "2px solid transparent",
                            }}
                          >
                            <info.icon />
                            <span className="font-urbanist text-[10px] text-gray-500 leading-tight text-center dark:text-gray-400">
                              {info.labelEs}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {dynamicCats.length > 0 && (
                      <div className="border-t border-gray-100 pt-2 dark:border-gray-700">
                        <p className="mb-1.5 font-urbanist text-[10px] font-medium text-gray-400 dark:text-gray-500">
                          {t("habits.customCategories")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dynamicCats.map((dcat) => {
                            const IconComp = LIST_ICONS.find((i) => i.name === dcat.icon);
                            const isActive = categoryId === dcat.id;
                            return (
                              <button
                                key={dcat.id}
                                type="button"
                                onClick={() => { setCategory("OTROS"); setCategoryId(dcat.id); }}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-urbanist text-xs transition-all"
                                style={{
                                  backgroundColor: isActive ? dcat.color + "20" : "#f3f4f6",
                                  border: isActive ? `2px solid ${dcat.color}` : "2px solid transparent",
                                  color: isActive ? dcat.color : "#6b7280",
                                }}
                              >
                                {IconComp && <IconComp.icon className="h-3.5 w-3.5" />}
                                {dcat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.priority")}
                  </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg font-urbanist text-sm font-medium transition-all dark:text-gray-400"
                          style={{
                            backgroundColor:
                              p <= priority ? catInfo.bgColor : "rgba(0,0,0,0.04)",
                            color: p <= priority ? catInfo.color : "#9CA3AF",
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.frequency")}
                  </label>
                  <div className="flex gap-2">
                    {(["daily", "weekly", "monthly"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFreqType(type)}
                        className="rounded-xl px-4 py-2 font-urbanist text-sm font-medium capitalize transition-all dark:text-gray-400"
                        style={{
                          backgroundColor:
                            freqType === type
                              ? catInfo.bgColor
                              : "rgba(0,0,0,0.04)",
                          color: freqType === type ? catInfo.color : "#6B7280",
                        }}
                      >
                        {t("habits." + type)}
                      </button>
                    ))}
                  </div>
                </div>

                {freqType === "weekly" && (
                  <div>
                    <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("habits.daysOfWeek")}
                    </label>
                    <div className="flex gap-1.5">
                      {WEEK_DAYS.map((d) => {
                        const isActive = selectedDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() =>
                              setSelectedDays((prev) =>
                                isActive
                                  ? prev.filter((v) => v !== d.value)
                                  : [...prev, d.value],
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-xl font-urbanist text-xs font-medium transition-all dark:text-gray-400"
                            style={{
                              backgroundColor: isActive
                                ? catInfo.bgColor
                                : "rgba(0,0,0,0.04)",
                              color: isActive ? catInfo.color : "#6B7280",
                              border: isActive
                                ? `1px solid ${catInfo.color}40`
                                : "1px solid transparent",
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.reminderTime")}{" "}
                    <span className="font-normal text-gray-400 dark:text-gray-500">{t("habits.optional")}</span>
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-32 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("habits.startDate")}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("habits.endDate")}{" "}
                      <span className="font-normal text-gray-400 dark:text-gray-500">{t("habits.optional")}</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("habits.description")}{" "}
                    <span className="font-normal text-gray-400 dark:text-gray-500">{t("habits.optional")}</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder={t("habits.descriptionPlaceholder")}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t("habits.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="flex-1 rounded-xl px-4 py-2.5 font-urbanist text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: catInfo.color,
                    }}
                  >
                    {saving ? t("habits.saving") : habit ? t("habits.saveChanges") : t("habits.createHabit")}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
