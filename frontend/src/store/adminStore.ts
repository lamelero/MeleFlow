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
  logoUrlDark: string;
  frontendUrl: string;
  backupInterval?: string;
  backupRetention?: number;
  backupEncrypted?: boolean;
}

export interface BackupEntry {
  name: string;
  size: number;
  date: string;
  encrypted: boolean;
}

export interface BackupSettings {
  backupInterval: string;
  backupRetention: number;
  backupEncrypted: boolean;
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
  uploadLogo: (file: File, variant?: "light" | "dark") => Promise<string>;
  removeLogo: (variant?: "light" | "dark") => Promise<void>;
  clearError: () => void;
  backups: BackupEntry[];
  backupSettings: BackupSettings;
  backupCreating: boolean;
  fetchBackups: () => Promise<void>;
  fetchBackupSettings: () => Promise<void>;
  createBackup: (encrypted?: boolean) => Promise<void>;
  deleteBackup: (name: string) => Promise<void>;
  restoreBackup: (name: string) => Promise<void>;
  updateBackupSettings: (data: Partial<BackupSettings>) => Promise<void>;
  wipeAllData: (password: string) => Promise<void>;
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
  logoUrlDark: "",
  frontendUrl: "http://localhost:3001",
  backupInterval: "manual",
  backupRetention: 10,
  backupEncrypted: false,
};

const defaultBackupSettings: BackupSettings = {
  backupInterval: "manual",
  backupRetention: 10,
  backupEncrypted: false,
};

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  stats: null,
  settings: defaultSettings,
  isLoading: false,
  error: null,
  backups: [],
  backupSettings: defaultBackupSettings,
  backupCreating: false,

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

  uploadLogo: async (file: File, variant: "light" | "dark" = "light") => {
    const formData = new FormData();
    formData.append("file", file);
    const params = variant === "dark" ? "?variant=dark" : "";
    const { data } = await client.post(`/admin/logo${params}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const key = variant === "dark" ? "logoUrlDark" : "logoUrl";
    set((state) => ({
      settings: { ...state.settings, [key]: data[key] },
    }));
    toast.success(variant === "dark" ? "Dark logo uploaded" : "Logo uploaded");
    return data[key];
  },

  removeLogo: async (variant: "light" | "dark" = "light") => {
    const params = variant === "dark" ? "?variant=dark" : "";
    await client.delete(`/admin/logo${params}`);
    const key = variant === "dark" ? "logoUrlDark" : "logoUrl";
    set((state) => ({
      settings: { ...state.settings, [key]: "" },
    }));
    toast.success(variant === "dark" ? "Dark logo removed" : "Logo removed");
  },

  // ── Backup methods ──────────────────────────

  fetchBackups: async () => {
    try {
      const { data } = await client.get("/admin/backups");
      set({ backups: data });
    } catch { /* silent */ }
  },

  fetchBackupSettings: async () => {
    try {
      const { data } = await client.get("/admin/backup-settings");
      set({ backupSettings: data });
    } catch { /* silent */ }
  },

  createBackup: async (encrypted = false) => {
    set({ backupCreating: true });
    try {
      await client.post("/admin/backup", { encrypted });
      toast.success("Backup created");
      await get().fetchBackups();
    } catch {
      toast.error("Failed to create backup");
    }
    set({ backupCreating: false });
  },

  deleteBackup: async (name) => {
    try {
      await client.delete(`/admin/backups/${encodeURIComponent(name)}`);
      toast.success("Backup deleted");
      await get().fetchBackups();
    } catch {
      toast.error("Failed to delete backup");
    }
  },

  restoreBackup: async (name) => {
    if (!window.confirm("Restore will overwrite all current data. Users will need to log in again. Continue?")) return;
    try {
      const { data } = await client.post(`/admin/restore/${encodeURIComponent(name)}`);
      if (data.warnings?.length > 0) {
        toast(`Restore completed with warnings: ${data.warnings.join("; ")}`, { icon: "⚠️" });
      } else {
        toast.success("Restore complete. Please log in again.");
      }
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch {
      toast.error("Failed to restore backup");
    }
  },

  updateBackupSettings: async (data) => {
    try {
      const res = await client.patch("/admin/backup-settings", data);
      set({ backupSettings: { ...get().backupSettings, ...res.data } });
      toast.success("Backup settings saved");
    } catch {
      toast.error("Failed to save backup settings");
    }
  },

  wipeAllData: async (password) => {
    await client.post("/admin/wipe", { password });
  },

  clearError: () => set({ error: null }),
}));
