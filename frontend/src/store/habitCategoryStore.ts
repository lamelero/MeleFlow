import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

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
  categories: [],
  isLoading: false,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const { data } = await client.get("/habit-categories");
      set({ categories: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createCategory: async (input) => {
    try {
      const { data } = await client.post("/habit-categories", input);
      set((state) => ({ categories: [...state.categories, data] }));
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
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
      }));
      toast.success("Category updated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to update category";
      toast.error(msg);
    }
  },

  deleteCategory: async (id) => {
    try {
      await client.delete(`/habit-categories/${id}`);
      set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
      toast.success("Category deleted");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to delete category";
      toast.error(msg);
    }
  },
}));
