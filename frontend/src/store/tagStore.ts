import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

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
      const { data } = await client.get("/tags");
      set({ tags: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTag: async (input) => {
    const { data } = await client.post("/tags", input);
    set((state) => ({ tags: [...state.tags, data] }));
    return data;
  },

  updateTag: async (id, input) => {
    const { data } = await client.patch(`/tags/${id}`, input);
    set((state) => ({
      tags: state.tags.map((t) => (t.id === id ? data : t)),
    }));
    toast.success("Tag updated");
  },

  deleteTag: async (id) => {
    await client.delete(`/tags/${id}`);
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }));
    toast.success("Tag deleted");
  },
}));
