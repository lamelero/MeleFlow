import { create } from "zustand";
import toast from "react-hot-toast";
import { newId } from "../sync/ids";
import { coalesceUpdate, enqueue, enqueueDelete, removePendingWhere } from "../sync/queue";
import {
  deleteRow,
  getAllRows,
  getRow,
  knownBaseVersion,
  localMeta,
  putRow,
  selectTags,
} from "../sync/repository";
import { useSyncStore } from "../sync/syncStore";
import type { TagRow, TaskTagRow } from "../sync/types";

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
}

const TAG_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

export function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  fetchTags: () => Promise<void>;
  createTag: (input: { name: string; color: string }) => Promise<Tag>;
  updateTag: (id: string, input: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],
  isLoading: false,

  fetchTags: async () => {
    set({ isLoading: true });
    try {
      set({ tags: await selectTags(), isLoading: false });
      const { initialized, online, scheduleSync } = useSyncStore.getState();
      if (initialized && online) scheduleSync(300);
    } catch {
      set({ isLoading: false });
    }
  },

  createTag: async (input) => {
    const id = newId();
    const row: TagRow = { ...localMeta(), id, name: input.name, color: input.color };
    await putRow("tags", row);
    await enqueue({ entity: "tag", action: "create", entityId: id, data: { name: row.name, color: row.color } });
    useSyncStore.getState().scheduleSync();
    const tags = await selectTags();
    set({ tags });
    return tags.find((t) => t.id === id) ?? { id, name: row.name, color: row.color };
  },

  updateTag: async (id, input) => {
    const existing = await getRow<TagRow>("tags", id);
    if (!existing) return;
    await putRow("tags", { ...existing, ...input, updatedAt: new Date().toISOString() });
    await coalesceUpdate("tag", id, { ...input }, knownBaseVersion(existing.version));
    useSyncStore.getState().scheduleSync();
    set({ tags: await selectTags() });
    toast.success("Tag updated");
  },

  deleteTag: async (id) => {
    const existing = await getRow<TagRow>("tags", id);
    // Local cascade: detach the tag from every task.
    const links = await getAllRows<TaskTagRow>("taskTags");
    await Promise.all(links.filter((l) => l.tagId === id).map((l) => deleteRow("taskTags", l.id)));
    await deleteRow("tags", id);
    // Drop queued links to a tag that is going away.
    await removePendingWhere("taskTag", (op) => op.data?.tagId === id);
    await enqueueDelete("tag", id, knownBaseVersion(existing?.version));
    useSyncStore.getState().scheduleSync();
    set({ tags: await selectTags() });
    toast.success("Tag deleted");
  },
}));

useSyncStore.subscribe((state, prev) => {
  if (state.dataVersion !== prev.dataVersion) {
    void selectTags().then((tags) => useTagStore.setState({ tags }));
  }
});
