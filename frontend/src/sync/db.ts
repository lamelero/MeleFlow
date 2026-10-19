import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  ChecklistItemRow,
  HabitCategoryRow,
  HabitLogRow,
  HabitRow,
  ListRow,
  OutboxOperation,
  TagRow,
  TaskRow,
  TaskTagRow,
} from "./types";

export const DB_NAME = "meleflow-sync";
export const DB_VERSION = 1;

export const ENTITY_STORES = [
  "lists",
  "tags",
  "tasks",
  "checklistItems",
  "taskTags",
  "habits",
  "habitCategories",
  "habitLogs",
] as const;

export type EntityStore = (typeof ENTITY_STORES)[number];

export const OUTBOX_STORE = "outbox";
export const META_STORE = "meta";

export interface MetaEntry {
  key: string;
  value: string;
}

export interface MeleFlowDB extends DBSchema {
  lists: { key: string; value: ListRow };
  tags: { key: string; value: TagRow };
  tasks: { key: string; value: TaskRow };
  checklistItems: { key: string; value: ChecklistItemRow };
  taskTags: { key: string; value: TaskTagRow };
  habits: { key: string; value: HabitRow };
  habitCategories: { key: string; value: HabitCategoryRow };
  habitLogs: { key: string; value: HabitLogRow };
  outbox: {
    key: number;
    value: OutboxOperation;
    indexes: { "by-operation": string };
  };
  meta: { key: string; value: MetaEntry };
}

let dbPromise: Promise<IDBPDatabase<MeleFlowDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MeleFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MeleFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of ENTITY_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const outbox = db.createObjectStore(OUTBOX_STORE, {
            keyPath: "seq",
            autoIncrement: true,
          });
          outbox.createIndex("by-operation", "operationId", { unique: true });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Drops the whole local database. Used on logout and in tests. */
export async function destroyDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}

/** Convenience meta accessors. */
export async function getMeta(key: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get(META_STORE, key);
  return entry?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put(META_STORE, { key, value });
}

export async function deleteMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete(META_STORE, key);
}
