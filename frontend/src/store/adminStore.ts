import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  storageUsed: string;
  storageQuota: string | null;
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
  maxStoragePerUser: number;
  maxLoginAttempts: number;
  loginLockoutMinutes: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  emailEnabled: boolean;
  emailSubject: string;
  logoUrl: string;
  frontendUrl: string;
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
  updateUser: (id: string, data: { email?: string; username?: string; displayName?: string; role?: string; isActive?: boolean; storageQuota?: number | null }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  testEmail: (to?: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  removeLogo: () => Promise<void>;
  clearError: () => void;
}

const defaultSettings: SystemSettings = {
  allowRegistration: true,
  maxUploadSize: 50,
  maxStoragePerUser: 1073741824,
  maxLoginAttempts: 5,
  loginLockoutMinutes: 15,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  fromEmail: "",
  emailEnabled: false,
  emailSubject: "Reminder: {{title}} is due soon",
  logoUrl: "",
  frontendUrl: "http://localhost:3001",
};

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  stats: null,
  settings: defaultSettings,
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
      set({ settings: { ...defaultSettings, ...data } });
    } catch {
      // use defaults
    }
  },

  updateSettings: async (input) => {
    try {
      const { data } = await client.patch("/admin/settings", input);
      set({ settings: { ...defaultSettings, ...data } });
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

  deleteUser: async (id) => {
    try {
      await client.delete(`/admin/users/${id}`);
      set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
      toast.success("User deleted");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete user";
      toast.error(msg);
    }
  },

  testEmail: async (to?: string) => {
    try {
      await client.post("/admin/test-email", to ? { to } : {});
      toast.success("Test email sent! Check your inbox.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to send test email";
      toast.error(msg);
    }
  },

  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await client.post("/admin/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((state) => ({
      settings: { ...state.settings, logoUrl: data.logoUrl },
    }));
    toast.success("Logo uploaded");
    return data.logoUrl;
  },

  removeLogo: async () => {
    await client.delete("/admin/logo");
    set((state) => ({
      settings: { ...state.settings, logoUrl: "" },
    }));
    toast.success("Logo removed");
  },

  clearError: () => set({ error: null }),
}));
