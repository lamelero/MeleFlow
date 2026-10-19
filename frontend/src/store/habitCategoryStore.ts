import { create } from "zustand";
import toast from "react-hot-toast";
import { newId } from "../sync/ids";
import { coalesceUpdate, enqueue, enqueueDelete, patchPendingWhere } from "../sync/queue";
import {
  deleteRow,
  getAllRows,
  getRow,
  knownBaseVersion,
  localMeta,
  putRow,
  selectCategories,
} from "../sync/repository";
import { useSyncStore } from "../sync/syncStore";
import type { HabitCategoryRow, HabitRow } from "../sync/types";

export interface HabitCategoryItem {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  _count?: { habits: number };
}

interface HabitCategoryStore {
  categories: HabitCategoryItem[];
  isLoading: boolean;
  colorVersion: number;
  fetchCategories: () => Promise<void>;
  createCategory: (input: { name: string; icon: string; color: string }) => Promise<HabitCategoryItem | null>;
  updateCategory: (id: string, input: Partial<HabitCategoryItem>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  bumpColorVersion: () => void;
}

export const useHabitCategoryStore = create<HabitCategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  colorVersion: 0,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      set({ categories: await selectCategories(), isLoading: false });
      const { initialized, online, scheduleSync } = useSyncStore.getState();
      if (initialized && online) scheduleSync(300);
    } catch {
      set({ isLoading: false });
    }
  },

  createCategory: async (input) => {
    const id = newId();
    const maxOrder = get().categories.reduce((max, c) => Math.max(max, c.order), -1);
    const row: HabitCategoryRow = {
      ...localMeta(),
      id,
      name: input.name,
      icon: input.icon,
      color: input.color,
      order: maxOrder + 1,
    };
    await putRow("habitCategories", row);
    await enqueue({
      entity: "habitCategory",
      action: "create",
      entityId: id,
      data: { name: row.name, icon: row.icon, color: row.color, order: row.order },
    });
    useSyncStore.getState().scheduleSync();
    set({ categories: await selectCategories() });
    toast.success("Category created");
    return { ...row, userId: "", _count: { habits: 0 } };
  },

  updateCategory: async (id, input) => {
    const existing = await getRow<HabitCategoryRow>("habitCategories", id);
    if (!existing) return;
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.color !== undefined) data.color = input.color;
    if (input.order !== undefined) data.order = input.order;

    await putRow("habitCategories", { ...existing, ...data, updatedAt: new Date().toISOString() });
    await coalesceUpdate("habitCategory", id, data, knownBaseVersion(existing.version));
    useSyncStore.getState().scheduleSync();
    set({ categories: await selectCategories() });
  },

  bumpColorVersion: () => set((s) => ({ colorVersion: s.colorVersion + 1 })),

  deleteCategory: async (id) => {
    const existing = await getRow<HabitCategoryRow>("habitCategories", id);
    // Local cascade: habits lose the category, like the server does.
    const habits = await getAllRows<HabitRow>("habits");
    await Promise.all(
      habits
        .filter((h) => h.categoryId === id)
        .map((h) => putRow("habits", { ...h, categoryId: null, updatedAt: new Date().toISOString() })),
    );
    await deleteRow("habitCategories", id);
    // Pending habit creates/updates must not reference a removed category.
    await patchPendingWhere("habit", (op) => op.data?.categoryId === id, { categoryId: null });
    await enqueueDelete("habitCategory", id, knownBaseVersion(existing?.version));
    useSyncStore.getState().scheduleSync();
    set({ categories: await selectCategories() });
    toast.success("Category deleted");
  },
}));

useSyncStore.subscribe((state, prev) => {
  if (state.dataVersion !== prev.dataVersion) {
    void selectCategories().then((categories) => useHabitCategoryStore.setState({ categories }));
  }
});
