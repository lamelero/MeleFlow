import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  frequency: string | null;
  startDate: string;
  endDate: string | null;
  isArchived: boolean;
  streakCount: number;
  totalDays: number;
  completedToday: boolean;
  logs: string[];
}

interface CreateHabitInput {
  name: string;
  description?: string | null;
  category?: string;
  priority?: number;
  frequency?: string | null;
  startDate?: string;
  endDate?: string | null;
}

interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  category?: string;
  priority?: number;
  frequency?: string | null;
  startDate?: string;
  endDate?: string | null;
  isArchived?: boolean;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: (archived?: boolean) => Promise<void>;
  fetchHabit: (id: string) => Promise<Habit>;
  createHabit: (input: CreateHabitInput) => Promise<void>;
  updateHabit: (id: string, input: UpdateHabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  checkIn: (id: string, date?: string) => Promise<void>;
  undoCheckIn: (id: string, date?: string) => Promise<void>;
  resetProgress: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,

  fetchHabits: async (archived = false) => {
    set({ isLoading: true });
    try {
      const params = archived ? "?archived=true" : "";
      const { data } = await client.get(`/habits${params}`);
      set({ habits: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchHabit: async (id: string) => {
    const { data } = await client.get(`/habits/${id}`);
    return data;
  },

  createHabit: async (input) => {
    try {
      const { data } = await client.post("/habits", input);
      set((state) => ({ habits: [data, ...state.habits] }));
      toast.success("Habit created");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to create habit";
      toast.error(msg);
    }
  },

  updateHabit: async (id, input) => {
    try {
      const { data } = await client.patch(`/habits/${id}`, input);
      set((state) => ({
        habits: state.habits.map((h) => (h.id === id ? { ...h, ...data } : h)),
      }));
      toast.success("Habit updated");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to update habit";
      toast.error(msg);
    }
  },

  deleteHabit: async (id) => {
    try {
      await client.delete(`/habits/${id}`);
      set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
      toast.success("Habit deleted");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete habit";
      toast.error(msg);
    }
  },

  checkIn: async (id, date) => {
    try {
      const params = date ? `?date=${date}` : "";
      await client.post(`/habits/${id}/progress${params}`);
      await get().fetchHabits();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to check in";
      toast.error(msg);
    }
  },

  undoCheckIn: async (id, date) => {
    try {
      const params = date ? `?date=${date}` : "";
      await client.delete(`/habits/${id}/progress${params}`);
      await get().fetchHabits();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to undo check-in";
      toast.error(msg);
    }
  },

  resetProgress: async (id) => {
    try {
      await client.post(`/habits/${id}/reset`);
      set((state) => ({
        habits: state.habits.map((h) =>
          h.id === id ? { ...h, logs: [], streakCount: 0, totalDays: 0, completedToday: false } : h,
        ),
      }));
      toast.success("Progress reset");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to reset progress";
      toast.error(msg);
    }
  },
}));
