import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HexColorPicker } from "react-colorful";
import { useHabitCategoryStore, type HabitCategoryItem } from "../../store/habitCategoryStore";
import { HABIT_CATEGORIES, HABIT_CATEGORY_KEYS, getCategoryColor, setCategoryColor } from "../../lib/habit-categories";
import { LIST_ICONS } from "../lists/listIcons";
import IconPicker from "../lists/IconPicker";

interface CategoryManagerProps {
  selectedId?: string | null;
  onSelect?: (category: HabitCategoryItem | null) => void;
}

export default function CategoryManager({ selectedId, onSelect }: CategoryManagerProps) {
  const { t } = useTranslation();
  const { categories, createCategory, updateCategory, deleteCategory, bumpColorVersion } = useHabitCategoryStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState("#14B8A6");
  const [editingName, setEditingName] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editColorId, setEditColorId] = useState<string | null>(null);
  const [editTempColor, setEditTempColor] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const sysPopoverRef = useRef<HTMLDivElement>(null);
  const [sysColorKey, setSysColorKey] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sysPopoverRef.current && !sysPopoverRef.current.contains(e.target as Node)) {
        setSysColorKey(null);
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (editColorId && editTempColor) {
          const cat = categories.find((c) => c.id === editColorId);
          if (cat && editTempColor !== cat.color) updateCategory(cat.id, { color: editTempColor });
        }
        setColorPickerOpen(false);
        setEditColorId(null);
        setEditTempColor("");
      }
    }
    if (colorPickerOpen || editColorId || sysColorKey) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [colorPickerOpen, editColorId, editTempColor, sysColorKey, categories, updateCategory]);

  async function handleCreate() {
    if (!name.trim() || !icon) return;
    const cat = await createCategory({ name: name.trim(), icon, color });
    if (cat) {
      setName("");
      setIcon(null);
      setColor("#14B8A6");
      setShowForm(false);
    }
  }

  function startEdit(cat: HabitCategoryItem) {
    setEditId(cat.id);
    setEditingName(cat.name);
  }

  async function handleRename(id: string) {
    if (editingName.trim()) {
      await updateCategory(id, { name: editingName.trim() });
    }
    setEditId(null);
  }

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-2">
      {/* Predefined system categories */}
      <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="mb-1.5 px-1 font-urbanist text-[10px] font-semibold uppercase tracking-wider text-gray-400">Categorías del sistema</p>
        <div className="space-y-0.5">
          {HABIT_CATEGORY_KEYS.map((key) => {
            const info = HABIT_CATEGORIES[key];
            const currentColor = getCategoryColor(key);
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg px-2 py-1">
                <span style={{ color: currentColor }}>{info.icon()}</span>
                <span className="flex-1 font-urbanist text-xs text-gray-600 dark:text-gray-400">{info.labelEs}</span>
                <div className="relative">
                  <div className="h-4 w-4 cursor-pointer rounded-full border border-gray-300"
                    style={{ backgroundColor: currentColor }}
                    onClick={(e) => { e.stopPropagation(); setSysColorKey(sysColorKey === key ? null : key); }} />
                  {sysColorKey === key && (
                    <div ref={sysPopoverRef} className="absolute right-0 top-5 z-20 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <HexColorPicker color={currentColor}
                        onChange={(c) => { setCategoryColor(key, c); bumpColorVersion(); }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sorted.map((cat) => {
        const IconComp = LIST_ICONS.find((i) => i.name === cat.icon);
        return (
          <div key={cat.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
            {editId === cat.id ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRename(cat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(cat.id);
                  if (e.key === "Escape") setEditId(null);
                }}
                className="flex-1 rounded border border-gray-200 px-2 py-1 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
            ) : (
              <button
                onClick={() => onSelect?.(cat)}
                className={`flex flex-1 items-center gap-2 rounded px-2 py-1 font-urbanist text-xs transition-colors ${
                  selectedId === cat.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span style={{ color: cat.color }}>
                  {IconComp ? <IconComp.icon className="h-4 w-4" /> : null}
                </span>
                <span>{cat.name}</span>
                {cat._count && cat._count.habits > 0 && (
                  <span className="ml-auto text-[10px] text-gray-400">{cat._count.habits}</span>
                )}
              </button>
            )}
            <div className="relative">
              <div className="h-4 w-4 cursor-pointer rounded-full border border-gray-300"
                style={{ backgroundColor: cat.id === editColorId && editTempColor ? editTempColor : cat.color }}
                onClick={(e) => { e.stopPropagation(); if (editColorId === cat.id) { setEditColorId(null); } else { setEditTempColor(cat.color); setEditColorId(cat.id); } }} />
              {editColorId === cat.id && (
                <div ref={popoverRef} className="absolute right-0 top-6 z-20 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <HexColorPicker color={editTempColor}
                    onChange={setEditTempColor} />
                </div>
              )}
            </div>
            <button
              onClick={() => startEdit(cat)}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete "${cat.name}"?`)) deleteCategory(cat.id);
              }}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        );
      })}

      {showForm ? (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-1">
            <IconPicker selected={icon} onSelect={setIcon} color={color} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("habits.categoryName") || "Category name"}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div className="relative">
            <div className="h-5 w-5 cursor-pointer rounded-full border border-gray-300"
              style={{ backgroundColor: color }}
              onClick={() => setColorPickerOpen(!colorPickerOpen)} />
            {colorPickerOpen && (
              <div className="absolute left-0 top-7 z-20 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                onPointerDownCapture={(e) => e.stopPropagation()}>
                <HexColorPicker color={color}
                  onChange={setColor} />
                <input value={color}
                  onChange={(e) => setColor(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono dark:border-gray-600 dark:bg-gray-700" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !icon}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white disabled:opacity-50"
            >
              {t("habits.createCategory") || "Create"}
            </button>
            <button
              onClick={() => { setShowForm(false); setName(""); setIcon(null); }}
              className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 font-urbanist text-xs text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t("habits.newCategory") || "New category"}
        </button>
      )}
    </div>
  );
}
