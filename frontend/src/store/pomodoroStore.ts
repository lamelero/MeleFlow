import { create } from "zustand";
import { client } from "../api/client";

export interface PomodoroSession {
  id: string;
  state: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  type: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
  duration: number;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  taskId: string | null;
  task?: { id: string; title: string } | null;
}

export interface PomodoroSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  cycles: number;
}

export interface PomodoroStats {
  completedToday: number;
  focusCompleted: number;
  nextPhase: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
  cycles: number;
}

interface PomodoroState {
  session: PomodoroSession | null;
  remainingSeconds: number;
  isLoading: boolean;
  settings: PomodoroSettings;
  stats: PomodoroStats | null;
  fetchCurrent: () => Promise<void>;
  start: (type?: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK", taskId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  tick: () => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (s: Partial<PomodoroSettings>) => Promise<void>;
  fetchStats: () => Promise<void>;
}

function calcRemaining(session: PomodoroSession): number {
  const totalSeconds = session.duration * 60;
  const started = new Date(session.startedAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - started) / 1000);

  if (session.state === "PAUSED" && session.pausedAt) {
    const pauseAt = new Date(session.pausedAt).getTime();
    const elapsedBeforePause = Math.floor((pauseAt - started) / 1000);
    return Math.max(0, totalSeconds - elapsedBeforePause);
  }

  return Math.max(0, totalSeconds - elapsed);
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  session: null,
  remainingSeconds: 0,
  isLoading: false,
  settings: { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 },
  stats: null,

  fetchCurrent: async () => {
    set({ isLoading: true });
    try {
      const { data } = await client.get("/pomodoro/current");
      if (data) {
        const remaining = calcRemaining(data);
        set({ session: data, remainingSeconds: remaining, isLoading: false });
      } else {
        set({ session: null, remainingSeconds: 0, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  start: async (type?: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK", taskId?: string) => {
    const { settings } = get();
    const body: Record<string, unknown> = {};
    if (type) body.type = type;
    if (taskId) body.taskId = taskId;

    const { data } = await client.post("/pomodoro/start", body);
    const duration = data.duration ?? settings.work;
    set({ session: data, remainingSeconds: duration * 60 });
  },

  pause: async () => {
    const { session } = get();
    if (!session) return;
    const { data } = await client.post(`/pomodoro/${session.id}/pause`);
    const remaining = calcRemaining(data);
    set({ session: data, remainingSeconds: remaining });
  },

  resume: async () => {
    const { session } = get();
    if (!session) return;
    const { data } = await client.post(`/pomodoro/${session.id}/resume`);
    const remaining = calcRemaining(data);
    set({ session: data, remainingSeconds: remaining });
  },

  complete: async () => {
    const { session } = get();
    if (!session) return;
    const { data } = await client.post(`/pomodoro/${session.id}/complete`);
    set({ session: data, remainingSeconds: 0 });
    get().fetchStats();
  },

  tick: () => {
    const { session, remainingSeconds } = get();
    if (!session || session.state !== "RUNNING") return;
    if (remainingSeconds <= 1) {
      get().complete();
      return;
    }
    set({ remainingSeconds: remainingSeconds - 1 });
  },

  fetchSettings: async () => {
    try {
      const { data } = await client.get("/pomodoro/settings");
      if (data) set({ settings: data });
    } catch {
      // keep defaults
    }
  },

  updateSettings: async (s: Partial<PomodoroSettings>) => {
    const body: Record<string, number> = {};
    if (s.work !== undefined) body.pomodoroWork = s.work;
    if (s.shortBreak !== undefined) body.pomodoroShortBreak = s.shortBreak;
    if (s.longBreak !== undefined) body.pomodoroLongBreak = s.longBreak;
    if (s.cycles !== undefined) body.pomodoroCycles = s.cycles;
    const { data } = await client.put("/pomodoro/settings", body);
    set({ settings: data });
  },

  fetchStats: async () => {
    try {
      const { data } = await client.get("/pomodoro/stats");
      if (data) set({ stats: data });
    } catch {
      // ignore
    }
  },
}));
