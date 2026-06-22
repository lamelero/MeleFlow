import { create } from "zustand";
import { client } from "../api/client";
import { DEFAULT_ICON } from "../components/lists/listIcons";

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

export const useListStore = create<ListState>((set, get) => ({
  lists: [],
  isLoading: false,
  error: null,

  fetchLists: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await client.get("/lists");
      set({ lists: data, isLoading: false });
    } catch {
      set({ error: "Failed to load lists", isLoading: false });
    }
  },

  createList: async (input) => {
    const { data } = await client.post("/lists", { ...input, icon: input.icon || DEFAULT_ICON });
    set((state) => ({ lists: [...state.lists, data] }));
    return data;
  },

  updateList: async (id, input) => {
    const { data } = await client.patch(`/lists/${id}`, input);
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? data : l)),
    }));
  },

  deleteList: async (id) => {
    const prev = get().lists;
    set((state) => ({ lists: state.lists.filter((l) => l.id !== id) }));
    try {
      await client.delete(`/lists/${id}`);
    } catch {
      set({ lists: prev });
    }
  },
}));
