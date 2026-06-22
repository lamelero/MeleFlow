import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";
import { scheduleTaskReminders } from "../capacitor/localNotifications";
import { isNative } from "../capacitor/register";
import { updateHabitData } from "../lib/browserNotifications";

const CACHE_KEY = "meleflow_habits";
const CACHE_TTL = 5 * 60 * 1000;

function loadCache(): { data: Habit[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(data: Habit[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

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
  logs: { date: string; status: string }[];
  categoryId?: string | null;
  habitCategory?: { id: string; name: string; icon: string; color: string } | null;
}

interface CreateHabitInput {
  name: string;
  description?: string | null;
  category?: string;
  priority?: number;
  frequency?: string | null;
  startDate?: string;
  endDate?: string | null;
  categoryId?: string | null;
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
  categoryId?: string | null;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: (archived?: boolean) => Promise<void>;
  fetchHabit: (id: string) => Promise<Habit>;
  createHabit: (input: CreateHabitInput) => Promise<void>;
  updateHabit: (id: string, input: UpdateHabitInput) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  checkIn: (id: string, date?: string, status?: string) => Promise<void>;
  undoCheckIn: (id: string, date?: string) => Promise<void>;
  resetProgress: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: loadCache()?.data ?? [],
  isLoading: false,

  fetchHabits: async (archived = false) => {
    const cached = loadCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (get().habits.length === 0) set({ habits: cached.data });
      return;
    }
    set({ isLoading: true });
    try {
      const params = archived ? "?archived=true" : "";
      const { data } = await client.get(`/habits${params}`);
      set({ habits: data, isLoading: false });
      saveCache(data);
      updateHabitData(data);
      if (isNative()) {
        setTimeout(() => {
          scheduleTaskReminders(
            data
              .filter((h: Habit) => h.frequency)
              .map((h: Habit) => ({
                id: h.id,
                title: h.name,
                dueDate: null,
                reminderEnabled: true,
                reminderConfig: h.frequency,
              }))
          );
        }, 0);
      }
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
      saveCache([data, ...get().habits]);
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
      const updated = get().habits.map((h) => (h.id === id ? { ...h, ...data } : h));
      set({ habits: updated });
      saveCache(updated);
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
      const updated = get().habits.filter((h) => h.id !== id);
      set({ habits: updated });
      saveCache(updated);
      toast.success("Habit deleted");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete habit";
      toast.error(msg);
    }
  },

  checkIn: async (id, date, status?) => {
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (status) params.set("status", status);
      await client.post(`/habits/${id}/progress?${params}`);
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
      const updated = get().habits.map((h) =>
        h.id === id ? { ...h, logs: [], streakCount: 0, totalDays: 0, completedToday: false } : h,
      );
      set({ habits: updated });
      saveCache(updated);
      toast.success("Progress reset");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to reset progress";
      toast.error(msg);
    }
  },
}));
