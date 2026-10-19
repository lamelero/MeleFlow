import { create } from "zustand";
import toast from "react-hot-toast";
import { App } from "@capacitor/app";
import {
  getLastSyncedAt,
  initSync,
  isSyncInitialized,
  onSyncEvent,
  pendingCount,
  resetLocalSync,
  setSyncTransport,
  sync,
} from "./engine";
import { axiosSyncTransport } from "./transport";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface SyncState {
  initialized: boolean;
  online: boolean;
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Bumped whenever local sync data changes, so stores can rehydrate. */
  dataVersion: number;
  start: (userId: string) => Promise<void>;
  stop: () => void;
  syncNow: () => Promise<void>;
  scheduleSync: (delayMs?: number) => void;
  refreshPending: () => Promise<void>;
  clearLocalData: () => Promise<void>;
}

const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

let startedFor: string | null = null;
/** Invalidates in-flight `start()` calls (StrictMode double-mount, user switch). */
let startGeneration = 0;
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeEvents: (() => void) | null = null;
let removeDomListeners: (() => void) | null = null;
let removeNativeListener: (() => void) | null = null;

function clearScheduled() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  initialized: false,
  online: isOnline(),
  status: "idle",
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  dataVersion: 0,

  start: async (userId: string) => {
    if (startedFor === userId && isSyncInitialized()) {
      if (get().online) await get().syncNow();
      return;
    }

    get().stop();
    const generation = ++startGeneration;
    setSyncTransport(axiosSyncTransport);
    await initSync(userId);
    if (generation !== startGeneration) return;
    startedFor = userId;

    unsubscribeEvents = onSyncEvent((event) => {
      if (event.type === "conflict") {
        toast.error("A newer server version replaced one of your offline changes.");
      } else if (event.type === "error") {
        toast.error(event.message || "An offline change could not be synced.");
      } else if (event.type === "reset") {
        toast("Local data was rebuilt from the server.");
      }
      set((s) => ({ dataVersion: s.dataVersion + 1 }));
    });

    // DOM connectivity + foreground triggers.
    if (typeof window !== "undefined") {
      const onOnline = () => {
        set({ online: true, status: "idle" });
        void get().syncNow();
      };
      const onOffline = () => {
        set({ online: false, status: "offline" });
      };
      const onVisible = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          void get().syncNow();
        }
      };
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisible);
      }
      removeDomListeners = () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisible);
        }
      };
    }

    // Capacitor: sync when the app returns to the foreground.
    try {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void get().syncNow();
      });
      removeNativeListener = () => {
        void handle.remove();
      };
    } catch {
      // Web / test environment without Capacitor.
    }

    intervalTimer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void get().syncNow();
      }
    }, 60_000);

    const [last, pending] = await Promise.all([getLastSyncedAt(), pendingCount()]);
    if (generation !== startGeneration) return;
    set({
      initialized: true,
      online: isOnline(),
      lastSyncedAt: last,
      pending,
      status: isOnline() ? "idle" : "offline",
    });

    if (isOnline()) await get().syncNow();
  },

  stop: () => {
    startGeneration++;
    clearScheduled();
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    unsubscribeEvents?.();
    unsubscribeEvents = null;
    removeDomListeners?.();
    removeDomListeners = null;
    removeNativeListener?.();
    removeNativeListener = null;
    startedFor = null;
    set({ initialized: false, status: "idle", pending: 0, lastError: null });
  },

  syncNow: async () => {
    if (!get().initialized || !isSyncInitialized()) return;
    if (!isOnline()) {
      set({ online: false, status: "offline" });
      return;
    }
    if (get().status === "syncing") return;

    set({ status: "syncing", lastError: null });
    try {
      await sync();
      const [pending, lastSyncedAt] = await Promise.all([pendingCount(), getLastSyncedAt()]);
      set({ pending, lastSyncedAt, status: "idle", online: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      const online = isOnline();
      set({
        status: online ? "error" : "offline",
        online,
        lastError: message,
      });
      if (!online) set({ pending: await pendingCount() });
    }
  },

  scheduleSync: (delayMs = 2500) => {
    void get().refreshPending();
    clearScheduled();
    scheduledTimer = setTimeout(() => {
      scheduledTimer = null;
      void get().syncNow();
    }, delayMs);
  },

  refreshPending: async () => {
    set({ pending: await pendingCount() });
  },

  clearLocalData: async () => {
    await resetLocalSync();
    set((s) => ({ pending: 0, lastSyncedAt: null, dataVersion: s.dataVersion + 1 }));
  },
}));
