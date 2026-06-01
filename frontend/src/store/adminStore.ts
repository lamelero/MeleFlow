import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { tasks: number; lists: number; habits: number };
}

export interface AdminStats {
  totalUsers: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalLists: number;
  totalHabits: number;
  totalPomodoros: number;
}

export interface SystemSettings {
  allowRegistration: boolean;
  maxUploadSize: number;
}

interface AdminState {
  users: AdminUser[];
  stats: AdminStats | null;
  settings: SystemSettings;
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<SystemSettings>) => Promise<void>;
  updateUser: (id: string, data: { role?: string; isActive?: boolean }) => Promise<void>;
  clearError: () => void;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  stats: null,
  settings: { allowRegistration: true, maxUploadSize: 50 },
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await client.get("/admin/users");
      set({ users: data, isLoading: false });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load users";
      set({ error: msg, isLoading: false });
    }
  },

  fetchStats: async () => {
    try {
      const { data } = await client.get("/admin/stats");
      set({ stats: data });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to load stats";
      set({ error: msg });
    }
  },

  fetchSettings: async () => {
    try {
      const { data } = await client.get("/admin/settings");
      set({ settings: data });
    } catch {
      // use defaults
    }
  },

  updateSettings: async (input) => {
    try {
      const { data } = await client.patch("/admin/settings", input);
      set({ settings: data });
      toast.success("Settings saved");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to save settings";
      set({ error: msg });
      toast.error(msg);
    }
  },

  updateUser: async (id, updateData) => {
    set({ error: null });
    try {
      const { data } = await client.put(`/admin/users/${id}`, updateData);
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
      }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to update user";
      set({ error: msg });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
