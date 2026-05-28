import { create } from "zustand";
import { client } from "../api/client";

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
}

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  fetchTags: () => Promise<void>;
  createTag: (input: { name: string; color: string }) => Promise<Tag>;
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
}));
