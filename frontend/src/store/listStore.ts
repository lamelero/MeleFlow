import { create } from "zustand";
import { DEFAULT_ICON } from "../components/lists/listIcons";
import { newId } from "../sync/ids";
import { coalesceUpdate, enqueue, enqueueDelete, patchPendingWhere } from "../sync/queue";
import {
  deleteRow,
  getAllRows,
  getRow,
  knownBaseVersion,
  localMeta,
  putRow,
  selectLists,
} from "../sync/repository";
import { useSyncStore } from "../sync/syncStore";
import type { ListRow } from "../sync/types";

interface List {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  _count: { tasks: number };
}

interface ListState {
  lists: List[];
  isLoading: boolean;
  error: string | null;
  fetchLists: () => Promise<void>;
  createList: (input: { name: string; color: string; icon?: string | null }) => Promise<List>;
  updateList: (id: string, input: { name?: string; color?: string; icon?: string | null }) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
}

export const useListStore = create<ListState>((set) => ({
  lists: [],
  isLoading: false,
  error: null,

  fetchLists: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ lists: await selectLists(), isLoading: false });
      const { initialized, online, scheduleSync } = useSyncStore.getState();
      if (initialized && online) scheduleSync(300);
    } catch {
      set({ error: "Failed to load lists", isLoading: false });
    }
  },

  createList: async (input) => {
    const id = newId();
    const row: ListRow = {
      ...localMeta(),
      id,
      name: input.name,
      color: input.color,
      icon: input.icon || DEFAULT_ICON,
      isSmart: false,
    };
    await putRow("lists", row);
    await enqueue({
      entity: "list",
      action: "create",
      entityId: id,
      data: { name: row.name, color: row.color, icon: row.icon },
    });
    useSyncStore.getState().scheduleSync();
    const lists = await selectLists();
    set({ lists });
    return lists.find((l) => l.id === id) ?? { id, name: row.name, color: row.color, icon: row.icon, _count: { tasks: 0 } };
  },

  updateList: async (id, input) => {
    const existing = await getRow<ListRow>("lists", id);
    if (!existing) return;
    const row: ListRow = { ...existing, ...input, updatedAt: new Date().toISOString() };
    await putRow("lists", row);
    await coalesceUpdate("list", id, { ...input }, knownBaseVersion(existing.version));
    useSyncStore.getState().scheduleSync();
    set({ lists: await selectLists() });
  },

  deleteList: async (id) => {
    const existing = await getRow<ListRow>("lists", id);
    // Local cascade: tasks in the list lose their list, like the server does.
    const tasks = await getAllRows<ListRow & { listId?: string | null }>("tasks");
    await Promise.all(
      tasks
        .filter((t) => t.listId === id)
        .map((t) => putRow("tasks", { ...t, listId: null, updatedAt: new Date().toISOString() })),
    );
    await deleteRow("lists", id);
    // Pending task creates/updates must not reference a list that is going away.
    await patchPendingWhere("task", (op) => op.data?.listId === id, { listId: null });
    await enqueueDelete("list", id, knownBaseVersion(existing?.version));
    useSyncStore.getState().scheduleSync();
    set({ lists: await selectLists() });
  },
}));

// Reload from IndexedDB whenever a sync run changes the local data.
useSyncStore.subscribe((state, prev) => {
  if (state.dataVersion !== prev.dataVersion) {
    void selectLists().then((lists) => useListStore.setState({ lists }));
  }
});
