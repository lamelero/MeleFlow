import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useListStore } from "../../store/listStore";
import { useTaskStore, type Task } from "../../store/taskStore";
import { useHabitStore, type Habit } from "../../store/habitStore";
import { useTagStore } from "../../store/tagStore";
import TaskList from "../../components/tasks/TaskList";
import TaskCard from "../../components/tasks/TaskCard";
import TaskDetailPanel from "../../components/tasks/TaskDetailPanel";
import HabitCard from "../../components/habits/HabitCard";
import HabitFormModal from "../../components/habits/HabitFormModal";
import AppLayout from "../../components/AppLayout";
import IconPicker from "../../components/lists/IconPicker";
import { ListIcon, LIST_ICONS } from "../../components/lists/listIcons";
import { isNative } from "../../capacitor/register";

const LIST_COLORS = [
  "#14B8A6", "#EF4444", "#F59E0B", "#3B82F6",
  "#8B5CF6", "#EC4899", "#10B981", "#6366F1",
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { lists, fetchLists, createList, updateList, deleteList } = useListStore();
  const { createTask, fetchSharedTasks, sharedTasks } = useTaskStore();
  const { habits, fetchHabits, createHabit } = useHabitStore();
  const { tags, fetchTags } = useTagStore();
  const [activeListId, setActiveListId] = useState<string | undefined>();
  const [activeTagId, setActiveTagId] = useState<string | undefined>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState<string | null>(null);
  const [newListColor, setNewListColor] = useState("#14B8A6");
  const [emojiPickerListId, setEmojiPickerListId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [habitFormOpen, setHabitFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [menuOpenListId, setMenuOpenListId] = useState<string | null>(null);
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLists();
    fetchHabits();
    fetchTags();
    fetchSharedTasks();
  }, [fetchLists, fetchHabits, fetchTags, fetchSharedTasks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingListId) renameInputRef.current?.focus();
  }, [editingListId]);

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
    await createTask({ title: newTaskTitle.trim(), listId: activeListId ?? null });
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
    <AppLayout title={t("dashboard.title")}>
      <motion.div
        className="h-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto flex h-full w-full max-w-6xl gap-6 p-4">
        <aside className="hidden w-56 shrink-0 space-y-4 md:block">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("dashboard.lists")}
              </h2>
              <button
                onClick={() => { setShowNewList(!showNewList); setNewListIcon(null); setNewListColor("#14B8A6"); }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {showNewList && (
              <form onSubmit={handleCreateList} className="mb-3 space-y-2">
                <div className="flex items-center gap-1">
                  <IconPicker selected={newListIcon} onSelect={setNewListIcon} />
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder={t("dashboard.listName")}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
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
              <button
                onClick={() => {
                  setActiveListId(undefined);
                  setActiveTagId(undefined);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left font-urbanist text-sm transition-colors ${
                  !activeListId && !activeTagId
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                {t("dashboard.allTasks")}
              </button>
              <Link
                to="/app/calendar"
                className="flex items-center gap-2 rounded-lg px-3 py-2 font-urbanist text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {t("dashboard.calendar")}
              </Link>
              {lists.map((list) => (
                <div key={list.id} className="relative">
                  <div className="flex items-center">
                    {editingListId === list.id ? (
                      <div className="flex flex-1 items-center gap-1 rounded-lg px-3 py-2">
                        <span className="mr-1 shrink-0">{list.icon ? <ListIcon name={list.icon} className="h-4 w-4 text-gray-500" /> : null}</span>
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
                            setActiveListId(list.id);
                            setActiveTagId(undefined);
                          }}
                          className={`flex flex-1 items-center rounded-lg px-3 py-2 text-left font-urbanist text-sm transition-colors ${
                            activeListId === list.id
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="mr-1 shrink-0">{list.icon ? <ListIcon name={list.icon} className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: list.color }} />}</span>
                          <span className="truncate">{list.name}</span>
                          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                            {list._count.tasks}
                          </span>
                        </button>
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
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 ${
                              list.icon === def.name ? "bg-primary/10 text-primary ring-2 ring-primary" : ""
                            }`}
                          >
                            <def.icon className="h-4 w-4" />
                          </button>
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
                <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t("dashboard.tags")}
                </h2>
                <Link
                  to="/tags"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              </div>
              <nav className="space-y-0.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                  className={`flex items-center w-full rounded-lg px-3 py-2 text-left font-urbanist text-sm transition-colors ${
                      activeTagId === tag.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 space-y-8 overflow-y-auto">
          <section>
            <form onSubmit={handleCreateTask} className="mb-4">
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={t("dashboard.newTask")}
                  className="w-full rounded-2xl bg-white px-5 py-3.5 font-urbanist text-sm outline-none placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </form>

            <TaskList
              filter={{ listId: activeListId, tagId: activeTagId }}
              onTaskClick={setSelectedTask}
              emptyMessage={
                activeListId
                  ? t("dashboard.noTasksInList")
                  : activeTagId
                    ? t("dashboard.noTasksWithTag")
                    : t("dashboard.noTasks")
              }
            />
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

          {!isNative() && <>
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
                <div className="grid gap-3 sm:grid-cols-2">
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

          <HabitFormModal
            isOpen={habitFormOpen}
            onClose={() => {
              setHabitFormOpen(false);
              setEditingHabit(null);
            }}
            onSave={handleSaveHabit}
            habit={editingHabit}
          />
        </>}
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
