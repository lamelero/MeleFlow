import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

const CACHE_KEY = "meleflow_habit_categories";
const CACHE_TTL = 30 * 60 * 1000;

function loadCache(): { data: HabitCategoryItem[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(data: HabitCategoryItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

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
  fetchCategories: () => Promise<void>;
  createCategory: (input: { name: string; icon: string; color: string }) => Promise<HabitCategoryItem | null>;
  updateCategory: (id: string, input: Partial<HabitCategoryItem>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useHabitCategoryStore = create<HabitCategoryStore>((set, get) => ({
  categories: loadCache()?.data ?? [],
  isLoading: false,

  fetchCategories: async () => {
    const cached = loadCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (get().categories.length === 0) set({ categories: cached.data });
      return;
    }
    set({ isLoading: true });
    try {
      const { data } = await client.get("/habit-categories");
      set({ categories: data, isLoading: false });
      saveCache(data);
    } catch {
      set({ isLoading: false });
    }
  },

  createCategory: async (input) => {
    try {
      const { data } = await client.post("/habit-categories", input);
      const updated = [...get().categories, data];
      set({ categories: updated });
      saveCache(updated);
      toast.success("Category created");
      return data;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create category";
      toast.error(msg);
      return null;
    }
  },

  updateCategory: async (id, input) => {
    try {
      const { data } = await client.patch(`/habit-categories/${id}`, input);
      const updated = get().categories.map((c) => (c.id === id ? { ...c, ...data } : c));
      set({ categories: updated });
      saveCache(updated);
      toast.success("Category updated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update category";
      toast.error(msg);
    }
  },

  deleteCategory: async (id) => {
    try {
      await client.delete(`/habit-categories/${id}`);
      const updated = get().categories.filter((c) => c.id !== id);
      set({ categories: updated });
      saveCache(updated);
      toast.success("Category deleted");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete category";
      toast.error(msg);
    }
  },
}));
