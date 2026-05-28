import { create } from "zustand";
import { client } from "../api/client";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  streakCount: number;
  frequency: string;
  color: string;
  icon: string | null;
  logs: string[];
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: () => Promise<void>;
  createHabit: (input: { name: string; color?: string; frequency?: string }) => Promise<void>;
  checkIn: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,

  fetchHabits: async () => {
    set({ isLoading: true });
    try {
      const { data } = await client.get("/habits");
      set({ habits: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createHabit: async (input) => {
    const { data } = await client.post("/habits", input);
    set((state) => ({ habits: [...state.habits, { ...data, logs: [] }] }));
  },

  checkIn: async (id) => {
    await client.post(`/habits/${id}/check`);
    await get().fetchHabits();
  },
}));
