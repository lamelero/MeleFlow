import { getDB, ENTITY_STORES, type EntityStore, type MeleFlowDB } from "./db";
import type { IDBPDatabase, IDBPTransaction } from "idb";
import type {
  ChecklistItemRow,
  HabitCategoryRow,
  HabitCategoryView,
  HabitLogRow,
  HabitRow,
  HabitView,
  ListRow,
  ListView,
  PullChanges,
  SyncEntity,
  SyncMeta,
  TagRow,
  TagView,
  TaskFilters,
  TaskRow,
  TaskTagRow,
  TaskView,
} from "./types";

/** Fluent userId for locally-created rows (set on sync init). */
let currentUserId = "";
export function setCurrentUserId(id: string): void {
  currentUserId = id;
}
export function getCurrentUserId(): string {
  return currentUserId;
}

/** Metadata for a row created offline (version "0" until the server confirms). */
export function localMeta(now: Date = new Date()): SyncMeta {
  const iso = now.toISOString();
  return { createdAt: iso, updatedAt: iso, deletedAt: null, version: "0" };
}

/** Base version to send for optimistic conflict detection, if known. */
export function knownBaseVersion(version: string | undefined): string | null {
  return version && version !== "0" ? version : null;
}

const ENTITY_TO_STORE: Record<SyncEntity, EntityStore> = {
  list: "lists",
  tag: "tags",
  task: "tasks",
  checklistItem: "checklistItems",
  taskTag: "taskTags",
  habit: "habits",
  habitCategory: "habitCategories",
  habitLog: "habitLogs",
};

// ── Generic local row access ─────────────────────

// A store name is a union, so idb cannot infer the row type from it. These
// helpers keep the store name dynamic while callers guarantee `T` matches.
type LooseDB = IDBPDatabase<unknown>;

async function getLooseDB(): Promise<LooseDB> {
  return (await getDB()) as unknown as LooseDB;
}

export async function putRow<T extends { id: string }>(store: EntityStore, row: T): Promise<void> {
  const db = await getLooseDB();
  await db.put(store, row);
}

export async function deleteRow(store: EntityStore, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
}

export async function getAllRows<T>(store: EntityStore): Promise<T[]> {
  const db = await getLooseDB();
  return (await db.getAll(store)) as T[];
}

export async function getRow<T>(store: EntityStore, id: string): Promise<T | undefined> {
  const db = await getLooseDB();
  return (await db.get(store, id)) as T | undefined;
}

/** Stores a canonical server row (after a create/update push). */
export async function putServerRow(entity: SyncEntity, row: { id: string; deletedAt?: string | null }): Promise<void> {
  const store = ENTITY_TO_STORE[entity];
  if (row.deletedAt) {
    await deleteRow(store, row.id);
  } else {
    await putRow(store, row);
  }
}

export async function removeEntity(entity: SyncEntity, id: string): Promise<void> {
  await deleteRow(ENTITY_TO_STORE[entity], id);
}

// ── Pull application ─────────────────────────────

type SyncRow = { id: string; deletedAt?: string | null };
type Group<T extends SyncRow> = { rows: T[]; store: EntityStore };
type EntityTx = IDBPTransaction<MeleFlowDB, typeof ENTITY_STORES, "readwrite">;

async function putGroup<T extends SyncRow>(tx: EntityTx, group: Group<T>, ops: IDBRequest[]): Promise<void> {
  // `group.store` is a union of store names; narrow to the raw object-store
  // shape we need (put/delete return IDBRequest, not a promise).
  const store = tx.objectStore(group.store) as unknown as {
    put(value: unknown): IDBRequest;
    delete(key: IDBValidKey): IDBRequest;
  };
  for (const row of group.rows) {
    if (row.deletedAt) {
      ops.push(store.delete(row.id));
    } else {
      ops.push(store.put(row));
    }
  }
}

/**
 * Writes a PULL delta into IndexedDB. Tombstoned rows are removed locally.
 * When `reset` is true (first sync or `resetRequired`) every entity store is
 * cleared first, giving a clean full snapshot.
 */
export async function applyPull(changes: PullChanges, reset: boolean): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...ENTITY_STORES], "readwrite");
  if (reset) {
    for (const store of ENTITY_STORES) tx.objectStore(store).clear();
  }
  const ops: IDBRequest[] = [];
  await Promise.all([
    putGroup(tx, { rows: changes.lists, store: "lists" }, ops),
    putGroup(tx, { rows: changes.tags, store: "tags" }, ops),
    putGroup(tx, { rows: changes.tasks, store: "tasks" }, ops),
    putGroup(tx, { rows: changes.checklistItems, store: "checklistItems" }, ops),
    putGroup(tx, { rows: changes.taskTags, store: "taskTags" }, ops),
    putGroup(tx, { rows: changes.habits, store: "habits" }, ops),
    putGroup(tx, { rows: changes.habitCategories, store: "habitCategories" }, ops),
    putGroup(tx, { rows: changes.habitLogs, store: "habitLogs" }, ops),
  ]);
  await Promise.all(ops);
  await tx.done;
}

export async function clearEntities(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...ENTITY_STORES], "readwrite");
  for (const store of ENTITY_STORES) tx.objectStore(store).clear();
  await tx.done;
}

// ── Snapshot loading ─────────────────────────────

interface Snapshot {
  lists: ListRow[];
  tags: TagRow[];
  tasks: TaskRow[];
  checklistItems: ChecklistItemRow[];
  taskTags: TaskTagRow[];
  habits: HabitRow[];
  habitCategories: HabitCategoryRow[];
  habitLogs: HabitLogRow[];
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await getDB();
  const [lists, tags, tasks, checklistItems, taskTags, habits, habitCategories, habitLogs] =
    await Promise.all([
      db.getAll("lists"),
      db.getAll("tags"),
      db.getAll("tasks"),
      db.getAll("checklistItems"),
      db.getAll("taskTags"),
      db.getAll("habits"),
      db.getAll("habitCategories"),
      db.getAll("habitLogs"),
    ]);
  return { lists, tags, tasks, checklistItems, taskTags, habits, habitCategories, habitLogs };
}

// ── Rehydration ──────────────────────────────────

function hydrateTask(row: TaskRow, snap: Snapshot): TaskView {
  const tags = snap.taskTags
    .filter((tt) => tt.taskId === row.id)
    .map((tt) => snap.tags.find((t) => t.id === tt.tagId))
    .filter((t): t is TagRow => Boolean(t))
    .map((t) => ({ id: t.id, name: t.name, color: t.color }));

  const checklistItems = snap.checklistItems
    .filter((c) => c.taskId === row.id)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, text: c.text, isCompleted: c.isCompleted, position: c.position }));

  const subTasks = snap.tasks
    .filter((t) => t.parentTaskId === row.id)
    .sort(subTaskOrder)
    .map((t) => ({ ...hydrateTask(t, snap), subTasks: [] as TaskView[] }));

  return {
    id: row.id,
    userId: currentUserId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    type: row.type,
    isCompleted: row.isCompleted,
    dueDate: row.dueDate,
    rrule: row.rrule,
    listId: row.listId,
    parentTaskId: row.parentTaskId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reminderEnabled: row.reminderEnabled,
    reminderConfig: row.reminderConfig,
    subTasks,
    tags,
    attachments: [],
    checklistItems,
    collaborators: [],
  };
}

function subTaskOrder(a: TaskRow, b: TaskRow): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function matchesFilters(row: TaskRow, snap: Snapshot, filters?: TaskFilters): boolean {
  if (!filters) return true;
  if (filters.listId && row.listId !== filters.listId) return false;
  if (filters.status === "completed" && !row.isCompleted) return false;
  if (filters.status === "pending" && row.isCompleted) return false;
  if (filters.priority && row.priority !== filters.priority) return false;
  if (filters.tagId) {
    const has = snap.taskTags.some((tt) => tt.taskId === row.id && tt.tagId === filters.tagId);
    if (!has) return false;
  }
  if (filters.dueDateFrom || filters.dueDateTo) {
    if (!row.dueDate) return false;
    const due = new Date(row.dueDate).getTime();
    if (filters.dueDateFrom && due < new Date(filters.dueDateFrom).getTime()) return false;
    if (filters.dueDateTo && due > new Date(filters.dueDateTo).getTime()) return false;
  }
  return true;
}

// ── Selectors (return UI view types) ─────────────

export async function selectTasks(filters?: TaskFilters): Promise<TaskView[]> {
  const snap = await loadSnapshot();
  return snap.tasks
    .filter((t) => t.parentTaskId === null)
    .filter((t) => matchesFilters(t, snap, filters))
    .sort((a, b) => subTaskOrder(a, b))
    .map((t) => hydrateTask(t, snap));
}

export async function selectTask(id: string): Promise<TaskView | null> {
  const snap = await loadSnapshot();
  const row = snap.tasks.find((t) => t.id === id);
  return row ? hydrateTask(row, snap) : null;
}

export async function selectLists(): Promise<ListView[]> {
  const snap = await loadSnapshot();
  return snap.lists
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      icon: l.icon,
      isSmart: l.isSmart,
      _count: {
        tasks: snap.tasks.filter((t) => t.listId === l.id && !t.isCompleted).length,
      },
    }));
}

export async function selectTags(): Promise<TagView[]> {
  const snap = await loadSnapshot();
  return snap.tags
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      _count: {
        tasks: snap.taskTags.filter(
          (tt) => tt.tagId === t.id && snap.tasks.some((task) => task.id === tt.taskId),
        ).length,
      },
    }));
}

export async function selectCategories(): Promise<HabitCategoryView[]> {
  const snap = await loadSnapshot();
  return snap.habitCategories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      id: c.id,
      userId: currentUserId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      order: c.order,
      _count: { habits: snap.habits.filter((h) => h.categoryId === c.id).length },
    }));
}

// ── Habit helpers ────────────────────────────────

interface StreakLog {
  date: string;
  status: string;
}

function getActiveDays(frequency: string | null): number[] | null {
  if (!frequency) return null;
  try {
    const f = JSON.parse(frequency);
    if (f.type === "weekly" && Array.isArray(f.days) && f.days.length > 0) {
      return f.days as number[];
    }
    return null;
  } catch {
    return null;
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Port of the backend HabitService streak algorithm. */
export function calculateStreak(logs: StreakLog[], frequency: string | null = null): number {
  if (logs.length === 0) return 0;

  const activeDays = getActiveDays(frequency);
  const statusMap = new Map<string, string>();
  for (const log of logs) {
    const d = new Date(`${log.date}T00:00:00Z`);
    if (!isNaN(d.getTime())) statusMap.set(dayKey(d), log.status);
  }

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let cursor = new Date(todayStart);
  let streak = 0;

  const todayStr = dayKey(todayStart);
  if (statusMap.get(todayStr) !== "completed") {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = dayKey(cursor);
    const dayOfWeek = cursor.getUTCDay();
    const hasCompletedForDay = statusMap.get(dateStr) === "completed";

    if (activeDays && !activeDays.includes(dayOfWeek) && !hasCompletedForDay) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }

    const status = statusMap.get(dateStr);
    if (status === "completed") {
      streak++;
    } else if (status === "skipped") {
      // skipped keeps the streak alive without adding to it
    } else {
      break;
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (i > 700) break;
  }

  return streak;
}

function hydrateHabit(
  row: HabitRow,
  snap: Snapshot,
  allLogs: HabitLogRow[],
  displayLogs: HabitLogRow[],
): HabitView {
  const todayStart = new Date();
  const todayKey = new Date(
    Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), todayStart.getUTCDate()),
  ).toISOString().slice(0, 10);

  const sortedLogs = displayLogs
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const category = row.categoryId
    ? snap.habitCategories.find((c) => c.id === row.categoryId) ?? null
    : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priority: row.priority,
    frequency: row.frequency,
    startDate: row.startDate,
    endDate: row.endDate,
    isArchived: row.isArchived,
    // Streak and total days are computed from every log, like the backend,
    // even when only the last 90 days are sent to the UI.
    streakCount: calculateStreak(
      allLogs.map((l) => ({ date: l.date, status: l.status })),
      row.frequency,
    ),
    totalDays: allLogs.filter((l) => l.status === "completed").length,
    completedToday: allLogs.some((l) => l.date === todayKey),
    logs: sortedLogs.map((l) => ({ date: l.date, status: l.status })),
    categoryId: row.categoryId,
    habitCategory: category
      ? { id: category.id, name: category.name, icon: category.icon, color: category.color }
      : null,
  };
}

export async function selectHabits(includeArchived = false): Promise<HabitView[]> {
  const snap = await loadSnapshot();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const cutoff = dayKey(ninetyDaysAgo);

  return snap.habits
    .filter((h) => (includeArchived ? true : !h.isArchived))
    .sort((a, b) => (a.priority !== b.priority ? b.priority - a.priority : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    .map((h) => {
      const allLogs = snap.habitLogs.filter((l) => l.habitId === h.id);
      const recentLogs = allLogs.filter((l) => l.date >= cutoff);
      return hydrateHabit(h, snap, allLogs, recentLogs);
    });
}

export async function selectHabit(id: string): Promise<HabitView | null> {
  const snap = await loadSnapshot();
  const row = snap.habits.find((h) => h.id === id);
  if (!row) return null;
  const logs = snap.habitLogs.filter((l) => l.habitId === id);
  return hydrateHabit(row, snap, logs, logs);
}

export async function selectHabitLogs(habitId: string): Promise<HabitLogRow[]> {
  const snap = await loadSnapshot();
  return snap.habitLogs.filter((l) => l.habitId === habitId);
}
