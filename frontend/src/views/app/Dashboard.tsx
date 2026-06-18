import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import CalendarContent from "../../components/calendar/CalendarContent";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useListStore } from "../../store/listStore";
import { useTaskStore, type Task } from "../../store/taskStore";
import { useHabitStore, type Habit } from "../../store/habitStore";
import { useHabitCategoryStore } from "../../store/habitCategoryStore";
import { useTagStore } from "../../store/tagStore";
import TaskList from "../../components/tasks/TaskList";
import TaskFilters from "../../components/tasks/TaskFilters";
import KanbanView from "../../components/tasks/KanbanView";
import EisenhowerMatrix from "../../components/tasks/EisenhowerMatrix";
import type { FilterPreset } from "../../components/tasks/TaskFilters";
import TaskCard from "../../components/tasks/TaskCard";
import TaskDetailPanel from "../../components/tasks/TaskDetailPanel";
import HabitCard from "../../components/habits/HabitCard";
import HabitFormModal from "../../components/habits/HabitFormModal";
import CategoryManager from "../../components/habits/CategoryManager";
import AppLayout from "../../components/AppLayout";
import IconPicker from "../../components/lists/IconPicker";
import { ListIcon, LIST_ICONS } from "../../components/lists/listIcons";
import { isNative } from "../../capacitor/register";
import { LayoutList, CheckSquare, Heart, Calendar } from "lucide-react";
import { parseTaskInput } from "../../lib/nlp";
import { registerShortcuts, clearShortcuts } from "../../lib/keyboardShortcuts";

const LIST_COLORS = [
  "#14B8A6", "#EF4444", "#F59E0B", "#3B82F6",
  "#8B5CF6", "#EC4899", "#10B981", "#6366F1",
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { lists, fetchLists, createList, updateList, deleteList } = useListStore();
  const { createTask, fetchSharedTasks, sharedTasks } = useTaskStore();
  const tasks = useTaskStore((s) => s.tasks);
  const { habits, fetchHabits, createHabit } = useHabitStore();
  const { fetchCategories } = useHabitCategoryStore();
  const { tags, fetchTags } = useTagStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const view: "all" | "tasks" | "habits" | "calendar" = searchParams.get("view") === "calendar" ? "calendar" : searchParams.get("view") === "tasks" ? "tasks" : searchParams.get("view") === "habits" ? "habits" : "all";
  const [activeListId, setActiveListId] = useState<string | undefined>();
  const [activeTagId, setActiveTagId] = useState<string | undefined>();
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "matrix">("list");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState<string | null>(null);
  const [newListColor, setNewListColor] = useState("#14B8A6");
  const [emojiPickerListId, setEmojiPickerListId] = useState<string | null>(null);
  const [colorPickerListId, setColorPickerListId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [menuOpenListId, setMenuOpenListId] = useState<string | null>(null);
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarOpen");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLists();
    fetchHabits();
    fetchCategories();
    fetchTags();
    fetchSharedTasks();
  }, [fetchLists, fetchHabits, fetchCategories, fetchTags, fetchSharedTasks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingListId) renameInputRef.current?.focus();
  }, [editingListId]);

  useEffect(() => {
    registerShortcuts({
      "n": () => { inputRef.current?.focus(); },
      "1": () => navigate("/app"),
      "2": () => navigate("/app?view=tasks"),
      "3": () => navigate("/app?view=habits"),
      "4": () => navigate("/app?view=calendar"),
    });
    return () => clearShortcuts();
  }, [navigate]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenListId(null);
      }
    }
    if (menuOpenListId) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenListId]);

  async function handleRename(listId: string) {
    const name = editingListName.trim();
    if (name && name !== lists.find((l) => l.id === listId)?.name) {
      await updateList(listId, { name });
    }
    setEditingListId(null);
    setEditingListName("");
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmListId) return;
    await deleteList(deleteConfirmListId);
    if (activeListId === deleteConfirmListId) setActiveListId(undefined);
    setDeleteConfirmListId(null);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const parsed = parseTaskInput(newTaskTitle);
    await createTask({ title: parsed.title, dueDate: parsed.dueDate, listId: activeListId ?? null });
    setNewTaskTitle("");
    inputRef.current?.focus();
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createList({ name: newListName.trim(), color: newListColor, icon: newListIcon });
    setNewListName("");
    setNewListIcon(null);
    setNewListColor("#14B8A6");
    setShowNewList(false);
  }

  async function handleSaveHabit(data: {
    name: string;
    description?: string | null;
    category: string;
    priority: number;
    frequency: string | null;
    startDate?: string;
    endDate?: string | null;
    categoryId?: string | null;
  }) {
    if (editingHabit) {
      await useHabitStore.getState().updateHabit(editingHabit.id, data);
    } else {
      await createHabit(data);
    }
    setEditingHabit(null);
  }

  function handleEditHabit(habit: Habit) {
    setEditingHabit(habit);
    setHabitFormOpen(true);
  }

  function handleTagClick(tagId: string | undefined) {
    setActiveTagId(activeTagId === tagId ? undefined : tagId);
  }

  return (
    <AppLayout title={view === "calendar" ? t("calendar.title") : view === "habits" ? t("dashboard.habits") : view === "tasks" ? t("dashboard.tasks") : t("dashboard.title")}>
      <motion.div
        className="h-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto flex h-full w-full max-w-6xl gap-6 p-4">
        <aside className={`relative hidden shrink-0 space-y-4 transition-all duration-200 md:block ${sidebarOpen ? "w-56" : "w-16"}`}>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); localStorage.setItem("sidebarOpen", String(!sidebarOpen)); }}
            className={`absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300 ${sidebarOpen ? "" : "rotate-180"}`}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            {sidebarOpen && <h2 className="mb-3 font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("dashboard.navigation")}
            </h2>}
            <nav className="space-y-0.5">
              <button
                onClick={() => { navigate("/app"); setActiveListId(undefined); setActiveTagId(undefined); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-[15px] transition-colors ${sidebarOpen ? "" : "justify-center"} ${
                  view === "all"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {sidebarOpen && t("dashboard.todo")}
              </button>
              <button
                onClick={() => { navigate("/app?view=tasks"); setActiveListId(undefined); setActiveTagId(undefined); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-[15px] transition-colors ${sidebarOpen ? "" : "justify-center"} ${
                  view === "tasks"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {sidebarOpen && t("dashboard.tasks")}
              </button>
              <button
                onClick={() => navigate("/app?view=habits")}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-[15px] transition-colors ${sidebarOpen ? "" : "justify-center"} ${
                  view === "habits"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <Heart className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {sidebarOpen && t("dashboard.habits")}
              </button>
              <button
                onClick={() => navigate("/app?view=calendar")}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-[15px] transition-colors ${sidebarOpen ? "" : "justify-center"} ${
                  view === "calendar"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                {sidebarOpen && t("dashboard.calendar")}
              </button>
            </nav>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <div className="mb-3 flex items-center justify-between">
              {sidebarOpen && <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("dashboard.lists")}
              </h2>}
              {sidebarOpen && (
              <button
                onClick={() => { setShowNewList(!showNewList); setNewListIcon(null); setNewListColor("#14B8A6"); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              )}
            </div>

            {showNewList && (
              <form onSubmit={handleCreateList} className="mb-3 space-y-2">
                <div className="flex items-center gap-1 min-w-0">
                  <IconPicker selected={newListIcon} onSelect={setNewListIcon} color={newListColor} />
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder={t("dashboard.listName")}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-1.5 px-0.5">
                  {LIST_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewListColor(c)}
                      className={`h-5 w-5 rounded-full transition-all ${
                        newListColor === c ? "ring-2 ring-gray-400 ring-offset-1 dark:ring-offset-gray-900" : "ring-1 ring-transparent hover:ring-gray-300"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </form>
            )}

            <nav className="space-y-0.5">
              {lists.map((list) => (
                <div key={list.id} className="relative">
                  <div className="flex items-center">
                    {editingListId === list.id ? (
                      <div className="flex flex-1 items-center gap-1 rounded-lg px-3 py-2">
                        <span className="mr-1 shrink-0">{list.icon ? <span style={{ color: list.color }}><ListIcon name={list.icon} className="h-4 w-4" /></span> : null}</span>
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={editingListName}
                          onChange={(e) => setEditingListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(list.id);
                            if (e.key === "Escape") { setEditingListId(null); setEditingListName(""); }
                          }}
                          onBlur={() => handleRename(list.id)}
                          className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-urbanist text-sm outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                          <button
                            onClick={() => {
                              setActiveListId(activeListId === list.id ? undefined : list.id);
                              setActiveTagId(undefined);
                            }}
                            className={`flex flex-1 items-center rounded-lg font-urbanist text-[15px] transition-colors ${sidebarOpen ? "px-3 py-2 text-left" : "justify-center px-0 h-8"} ${
                              activeListId === list.id
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                            }`}
                          >
                            <span className="shrink-0">{list.icon ? <span style={{ color: list.color }}><ListIcon name={list.icon} className="h-4 w-4" /></span> : <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: list.color }} />}</span>
                            {sidebarOpen && <span className="ml-2 truncate">{list.name}</span>}
                            {sidebarOpen && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{list._count.tasks}</span>}
                          </button>
                        {sidebarOpen && <>
                          <button
                            onClick={() => setMenuOpenListId(menuOpenListId === list.id ? null : list.id)}
                            className="flex shrink-0 items-center justify-center rounded-lg px-1.5 py-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="8" cy="3" r="1.5" />
                              <circle cx="8" cy="8" r="1.5" />
                              <circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </button>
                        </>}
                      </>
                    )}
                  </div>

                  {menuOpenListId === list.id && (
                    <div ref={menuRef}
                      className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    >
                      <button
                        onClick={() => {
                          setEditingListId(list.id);
                          setEditingListName(list.name);
                          setMenuOpenListId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {t("dashboard.rename")}
                      </button>
                      <button
                        onClick={() => {
                          setEmojiPickerListId(list.id);
                          setMenuOpenListId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {t("dashboard.changeEmoji")}
                      </button>
                      <button
                        onClick={() => {
                          setColorPickerListId(list.id);
                          setMenuOpenListId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {t("dashboard.changeColor")}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmListId(list.id);
                          setMenuOpenListId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 font-urbanist text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {t("dashboard.delete")}
                      </button>
                    </div>
                  )}

                  {emojiPickerListId === list.id && (
                    <div className="absolute left-0 top-full z-30 mt-1 w-[272px] rounded-xl border bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <div className="mb-1 flex items-center justify-between px-1">
                        <span className="font-urbanist text-[10px] text-gray-400">{t("dashboard.icon")}</span>
                        {list.icon && (
                          <button
                            type="button"
                            onClick={() => { updateList(list.id, { icon: null }); setEmojiPickerListId(null); }}
                            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                            onClick={() => {
                              updateList(list.id, { icon: def.name === list.icon ? null : def.name });
                              setEmojiPickerListId(null);
                            }}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              list.icon === def.name ? "bg-primary/10 ring-2 ring-primary" : ""
                            }`}
                          >
                            <span style={{ color: list.color }}><def.icon className="h-4 w-4" /></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {colorPickerListId === list.id && (
                    <div className="absolute left-0 top-full z-30 mt-1 rounded-xl border bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <div className="mb-1 px-1">
                        <span className="font-urbanist text-[10px] text-gray-400">{t("dashboard.changeColor")}</span>
                      </div>
                      <div className="flex gap-1.5 px-0.5">
                        {LIST_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { updateList(list.id, { color: c }); setColorPickerListId(null); }}
                            className={`h-7 w-7 rounded-full transition-all ${
                              list.color === c ? "ring-2 ring-gray-400 ring-offset-2 dark:ring-offset-gray-900" : "ring-1 ring-transparent hover:ring-gray-300"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>

          {tags.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
              <div className="mb-3 flex items-center justify-between">
                {sidebarOpen && <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("dashboard.tags")}
                </h2>}
                {sidebarOpen && <Link
                  to="/tags"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>}
              </div>
              <nav className="space-y-0.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                  className={`flex items-center w-full rounded-lg px-3 py-2 text-left font-urbanist text-[15px] transition-colors ${sidebarOpen ? "" : "justify-center"} ${
                      activeTagId === tag.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {sidebarOpen && <span className="ml-2">{tag.name}</span>}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {view === "calendar" ? (
            <CalendarContent standalone={false} />
          ) : view === "habits" ? (
            <div className="space-y-6 p-4">
              <div className="flex items-center justify-between">
                <h1 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("dashboard.habits")}
                </h1>
                <button
                  onClick={() => { setEditingHabit(null); setHabitFormOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t("dashboard.newHabit")}
                </button>
              </div>

              {habits.filter((h) => !h.isArchived).length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                  <p className="font-urbanist text-sm text-gray-400">{t("dashboard.noHabits")}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {habits.filter((h) => !h.isArchived).map((habit) => (
                    <HabitCard key={habit.id} habit={habit} onEdit={handleEditHabit} />
                  ))}
                </div>
              )}

              {habits.filter((h) => h.isArchived).length > 0 && (
                <div>
                  <h2 className="mb-3 font-outfit text-base font-semibold text-gray-500 dark:text-gray-400">
                    {t("dashboard.archived")}
                  </h2>
                  <div className="grid gap-3 opacity-50 sm:grid-cols-2 lg:grid-cols-3">
                    {habits.filter((h) => h.isArchived).map((habit) => (
                      <HabitCard key={habit.id} habit={habit} onEdit={handleEditHabit} />
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h2 className="mb-3 font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("habits.categories") || "Categories"}
                </h2>
                <CategoryManager />
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <form onSubmit={handleCreateTask} className="mb-4">
                  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder={t("dashboard.newTask")}
                      className="w-full rounded-2xl bg-white px-5 py-3.5 font-urbanist text-[15px] outline-none placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                </form>

                <div className="mb-4 flex items-center gap-2">
                  <div className="flex-1">
                    <TaskFilters active={filterPreset} onChange={setFilterPreset} />
                  </div>
                  <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                    {(["list", "kanban", "matrix"] as const).map((vm) => (
                      <button
                        key={vm}
                        onClick={() => setViewMode(vm)}
                        className={`rounded-md px-2.5 py-1 font-urbanist text-xs font-medium transition-all ${
                          viewMode === vm
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        {vm === "list" && "List"}
                        {vm === "kanban" && "Kanban"}
                        {vm === "matrix" && "Matrix"}
                      </button>
                    ))}
                  </div>
                </div>

                {viewMode === "list" && (
                  <TaskList
                    filter={{ listId: activeListId, tagId: activeTagId, preset: filterPreset }}
                    onTaskClick={setSelectedTask}
                    emptyMessage={
                      activeListId
                        ? t("dashboard.noTasksInList")
                        : activeTagId
                          ? t("dashboard.noTasksWithTag")
                          : t("dashboard.noTasks")
                    }
                  />
                )}
                {viewMode === "kanban" && (
                  <KanbanView
                    tasks={tasks}
                    filter={{ listId: activeListId, tagId: activeTagId, preset: filterPreset }}
                    onTaskClick={setSelectedTask}
                  />
                )}
                {viewMode === "matrix" && (
                  <EisenhowerMatrix
                    tasks={tasks}
                    onTaskClick={setSelectedTask}
                  />
                )}
              </section>

              {sharedTasks.length > 0 && (
                <section>
                  <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t("dashboard.sharedWithMe")}
                  </h2>
                  <div className="space-y-2">
                    {sharedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={setSelectedTask} />
                    ))}
                  </div>
                </section>
              )}

              {view === "all" && !isNative() && <>
                <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t("dashboard.habits")}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingHabit(null);
                      setHabitFormOpen(true);
                    }}
                    className="rounded-xl px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors"
                    style={{ backgroundColor: "#14B8A6" }}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {t("dashboard.newHabit")}
                    </span>
                  </button>
                </div>

                {habits.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800"
                  >
                    <svg
                      className="mx-auto mb-4 h-16 w-16 dark:opacity-70"
                      viewBox="0 0 64 64"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect x="10" y="14" width="44" height="36" rx="6" stroke="#14B8A6" strokeWidth="2" strokeDasharray="4 3" fill="rgba(20,184,166,0.05)" />
                      <circle cx="22" cy="30" r="4" fill="#14B8A6" opacity="0.2" />
                      <circle cx="34" cy="30" r="4" fill="#14B8A6" opacity="0.2" />
                      <circle cx="46" cy="30" r="4" fill="#14B8A6" opacity="0.2" />
                      <circle cx="22" cy="42" r="4" fill="#14B8A6" opacity="0.2" />
                      <circle cx="34" cy="42" r="4" fill="#14B8A6" opacity="0.15" />
                      <circle cx="46" cy="42" r="4" fill="#14B8A6" opacity="0.1" />
                      <path d="M16 8l-2 4m16-4l2 4M36 6l-1 6M44 10l-3 2" stroke="#14B8A6" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
                    </svg>
                    <p className="font-urbanist text-sm text-gray-400">
                      {t("dashboard.noHabits")}
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    {/* Active habits */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {habits
                        .filter((h) => !h.isArchived)
                        .map((habit) => (
                          <HabitCard
                            key={habit.id}
                            habit={habit}
                            onEdit={handleEditHabit}
                          />
                        ))}
                    </div>

                    {/* Archived habits */}
                    {habits.filter((h) => h.isArchived).length > 0 && (
                      <div>
                        <h3 className="mb-3 font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400">
                          {t("dashboard.archived")}
                        </h3>
                        <div className="grid gap-3 opacity-50 sm:grid-cols-2">
                          {habits
                            .filter((h) => h.isArchived)
                            .map((habit) => (
                              <HabitCard
                                key={habit.id}
                                habit={habit}
                                onEdit={handleEditHabit}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

            </>}
            </div>
          )}

          <HabitFormModal
            isOpen={habitFormOpen}
            onClose={() => {
              setHabitFormOpen(false);
              setEditingHabit(null);
            }}
            onSave={handleSaveHabit}
            habit={editingHabit}
          />
        </main>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {deleteConfirmListId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteConfirmListId(null)}>
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-gray-200/50 bg-white p-6 shadow-2xl dark:border-gray-700/50 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-urbanist text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("dashboard.deleteList")}
            </h3>
            <p className="mt-2 font-urbanist text-xs text-gray-500 dark:text-gray-400">
              {t("dashboard.deleteListWarning")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmListId(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 font-urbanist text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("dashboard.cancel")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-500 px-4 py-2 font-urbanist text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                {t("dashboard.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
      </motion.div>
    </AppLayout>
  );
}
