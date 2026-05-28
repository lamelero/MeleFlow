import { create } from "zustand";
import { client } from "../api/client";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  language: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  updateLanguage: (lang: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data } = await client.get("/auth/me");
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const { data } = await client.post("/auth/login", { email, password });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      set({ user: data.user, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Login failed";
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
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      set({ user: data.user, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Registration failed";
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      if (refreshToken) {
        await client.post("/auth/logout", { refreshToken });
      }
    } catch {
      // Silently ignore logout errors
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
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
      // Silently ignore — language persists in localStorage anyway
    }
  },

  clearError: () => set({ error: null }),
}));
