import { create } from "zustand";
import { client } from "../api/client";

export interface PomodoroSession {
  id: string;
  state: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  duration: number;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  taskId: string | null;
  task?: { id: string; title: string } | null;
}

interface PomodoroState {
  session: PomodoroSession | null;
  remainingSeconds: number;
  isLoading: boolean;
  fetchCurrent: () => Promise<void>;
  start: (duration?: number, taskId?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  tick: () => void;
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

  start: async (duration = 25, taskId?: string) => {
    const { data } = await client.post("/pomodoro/start", { duration, taskId });
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
}));
