import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useListStore } from "../../store/listStore";
import { useTaskStore, type Task } from "../../store/taskStore";
import { useHabitStore } from "../../store/habitStore";
import { useTagStore } from "../../store/tagStore";
import TaskList from "../../components/tasks/TaskList";
import TaskDetailPanel from "../../components/tasks/TaskDetailPanel";
import HabitCard from "../../components/habits/HabitCard";
import AppLayout from "../../components/AppLayout";

export default function Dashboard() {
  const { lists, fetchLists, createList } = useListStore();
  const { createTask } = useTaskStore();
  const { habits, fetchHabits, createHabit } = useHabitStore();
  const { tags, fetchTags } = useTagStore();
  const [activeListId, setActiveListId] = useState<string | undefined>();
  const [activeTagId, setActiveTagId] = useState<string | undefined>();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newHabitName, setNewHabitName] = useState("");
  const [showNewHabit, setShowNewHabit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLists();
    fetchHabits();
    fetchTags();
  }, [fetchLists, fetchHabits, fetchTags]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    await createList({ name: newListName.trim(), color: "#14B8A6" });
    setNewListName("");
    setShowNewList(false);
  }

  async function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    await createHabit({ name: newHabitName.trim() });
    setNewHabitName("");
    setShowNewHabit(false);
  }

  function handleTagClick(tagId: string | undefined) {
    setActiveTagId(activeTagId === tagId ? undefined : tagId);
  }

  return (
    <AppLayout title="Dashboard">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto flex w-full max-w-6xl gap-6 p-4">
        <aside className="w-56 shrink-0 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                Lists
              </h2>
              <button
                onClick={() => setShowNewList(!showNewList)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {showNewList && (
              <form onSubmit={handleCreateList} className="mb-3">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  autoFocus
                />
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
                All tasks
              </button>
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => {
                    setActiveListId(list.id);
                    setActiveTagId(undefined);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left font-urbanist text-sm transition-colors ${
                    activeListId === list.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                  {list.name}
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    {list._count.tasks}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {tags.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Tags
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
                    className={`w-full rounded-lg px-3 py-2 text-left font-urbanist text-sm transition-colors ${
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

        <main className="min-w-0 flex-1 space-y-8">
          <section>
            <form onSubmit={handleCreateTask} className="mb-4">
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a new task..."
                  className="w-full rounded-2xl bg-white px-5 py-3.5 font-urbanist text-sm outline-none placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </form>

            <TaskList
              filter={{ listId: activeListId, tagId: activeTagId, status: "pending" }}
              onTaskClick={setSelectedTask}
              emptyMessage={
                activeListId
                  ? "No tasks in this list"
                  : activeTagId
                    ? "No tasks with this tag"
                    : "No tasks yet — create one above"
              }
            />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                Habits
              </h2>
              <button
                onClick={() => setShowNewHabit(!showNewHabit)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {showNewHabit && (
              <form onSubmit={handleCreateHabit} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="Habit name"
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-medium text-white"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

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
                  No habits yet — create one above
                </p>
              </motion.div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {habits.map((habit) => (
                  <HabitCard key={habit.id} habit={habit} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
      </motion.div>
    </AppLayout>
  );
}
