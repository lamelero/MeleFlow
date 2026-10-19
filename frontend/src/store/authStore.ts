import { create } from "zustand";
import { isNative } from "../capacitor/register";
import {
  getPersistedRefreshToken,
  setPersistedRefreshToken,
  getCachedUser,
  setCachedUser,
  clearCachedUser,
} from "../capacitor/register";
import { client, setAccessToken, getAccessToken, setRefreshToken, getRefreshToken } from "../api/client";
import { useSyncStore } from "../sync/syncStore";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  notificationEmail?: string | null;
  bio?: string | null;
  timezone?: string | null;
  notificationPrefs?: { email: boolean; push: boolean; browser: boolean };
  role: string;
  language: string;
  isTwoFactorEnabled?: boolean;
}

export interface LoginResult {
  accessToken?: string;
  user?: User;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  twoFactorMethod?: "totp" | "email";
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  verify2FA: (twoFactorToken: string, code: string, trustDevice?: boolean) => Promise<void>;
  sendOTP: (twoFactorToken: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  updateLanguage: (lang: string) => Promise<void>;
  updateProfile: (data: { displayName?: string; notificationEmail?: string; bio?: string; timezone?: string }) => Promise<void>;
  updateNotificationPrefs: (prefs: { email?: boolean; push?: boolean; browser?: boolean }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  clearError: () => void;
}

let _initializing = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    if (_initializing) return;
    _initializing = true;
    const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;

    async function restoreCachedSession(): Promise<boolean> {
      const cached = await getCachedUser();
      if (cached) {
        set({ user: cached as User, isAuthenticated: true, isLoading: false });
        return true;
      }
      return false;
    }

    try {
      const existingToken = getAccessToken();
      if (existingToken) {
        try {
          const { data } = await client.get("/auth/me");
          set({ user: data, isAuthenticated: true, isLoading: false });
          await setCachedUser(data);
          return;
        } catch {
          setAccessToken(null);
        }
      }
      if (isNative()) {
        const persisted = await getPersistedRefreshToken();
        if (persisted) {
          setRefreshToken(persisted);
        }
      }

      // Offline boot: serve the cached profile without hitting the network.
      if (!online && (await restoreCachedSession())) return;

      const rt = getRefreshToken();
      const { data } = await client.post("/auth/refresh", { rememberMe: true, refreshToken: rt || undefined });
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setPersistedRefreshToken(data.refreshToken);
      set({ user: data.user, isAuthenticated: true, isLoading: false });
      await setCachedUser(data.user);
    } catch (err) {
      // A rejected token means the session is gone; a network error does not.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 401 && status !== 403 && (await restoreCachedSession())) return;
      set({ user: null, isAuthenticated: false, isLoading: false });
    } finally {
      _initializing = false;
    }
  },

  login: async (email, password, rememberMe = false) => {
    set({ error: null });
    try {
      const { data } = await client.post("/auth/login", { email, password, rememberMe });

      if (data.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          twoFactorToken: data.twoFactorToken,
          twoFactorMethod: data.twoFactorMethod,
          user: data.user,
        };
      }

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setPersistedRefreshToken(data.refreshToken);
      set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
      await setCachedUser(data.user);
      return { accessToken: data.accessToken, user: data.user };
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Login failed";
      set({ error: message });
      throw err;
    }
  },

  verify2FA: async (twoFactorToken, code, trustDevice = false) => {
    set({ error: null });
    try {
      const { data } = await client.post("/auth/verify-2fa", { twoFactorToken, code, trustDevice });
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setPersistedRefreshToken(data.refreshToken);
      set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
      await setCachedUser(data.user);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Invalid 2FA code";
      set({ error: message });
      throw err;
    }
  },

  sendOTP: async (twoFactorToken) => {
    set({ error: null });
    try {
      await client.post("/auth/2fa/send-otp", { twoFactorToken });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to send code";
      set({ error: message });
      throw err;
    }
  },

  register: async (email, username, password) => {
    set({ error: null });
    try {
      const { data } = await client.post("/auth/register", {
        email,
        username,
        password,
      });
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setPersistedRefreshToken(data.refreshToken);
      set({ user: data.user, isAuthenticated: true, isLoading: false, error: null });
      await setCachedUser(data.user);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Registration failed";
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await client.post("/auth/logout");
    } catch {
      // Silently ignore logout errors
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      setPersistedRefreshToken(null);
      useSyncStore.getState().stop();
      await clearCachedUser();
      await useSyncStore.getState().clearLocalData();
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  updateLanguage: async (lang) => {
    try {
      await client.patch("/auth/language", { language: lang });
      set((state) => ({
        user: state.user ? { ...state.user, language: lang } : null,
      }));
    } catch {
      // Silently ignore
    }
  },

  updateProfile: async (data) => {
    const res = await client.patch("/auth/profile", data);
    set({ user: res.data });
  },

  updateNotificationPrefs: async (prefs) => {
    const res = await client.patch("/auth/notification-prefs", prefs);
    set((state) => ({
      user: state.user ? { ...state.user, notificationPrefs: res.data } : null,
    }));
    if (prefs.browser === false) {
      const { cancelBrowserReminders } = await import("../lib/browserNotifications");
      cancelBrowserReminders();
    }
  },

  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await client.post("/auth/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const { avatarUrl } = res.data;
    set((state) => ({
      user: state.user ? { ...state.user, avatarUrl } : null,
    }));
    return avatarUrl;
  },

  clearError: () => set({ error: null }),
}));
