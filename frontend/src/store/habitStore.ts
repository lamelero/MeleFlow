import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";
import { scheduleTaskReminders } from "../capacitor/localNotifications";
import { isNative } from "../capacitor/register";
import { updateHabitData } from "../lib/browserNotifications";
import { newId } from "../sync/ids";
import { coalesceUpdate, enqueue, enqueueDelete, removePendingWhere } from "../sync/queue";
import {
  deleteRow,
  getAllRows,
  getRow,
  knownBaseVersion,
  localMeta,
  putRow,
  selectHabit,
  selectHabits,
} from "../sync/repository";
import { useSyncStore } from "../sync/syncStore";
import type { HabitLogRow, HabitRow, HabitView } from "../sync/types";

export type Habit = HabitView;

function scheduleHabitReminders(habits: HabitView[]) {
  if (!isNative()) return;
  setTimeout(() => {
    scheduleTaskReminders(
      habits
        .filter((h) => h.frequency)
        .map((h) => ({
          id: h.id,
          title: h.name,
          dueDate: null,
          reminderEnabled: true,
          reminderConfig: h.frequency,
        })),
    );
  }, 0);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
  habits: [],
  isLoading: false,

  fetchHabits: async (archived = false) => {
    set({ isLoading: true });
    try {
      const habits = await selectHabits(archived);
      set({ habits, isLoading: false });
      updateHabitData(habits);
      scheduleHabitReminders(habits);
      const { initialized, online, scheduleSync } = useSyncStore.getState();
      if (initialized && online) scheduleSync(300);
    } catch {
      set({ isLoading: false });
    }
  },

  fetchHabit: async (id: string) => {
    let habit = await selectHabit(id);
    if (!habit) {
      const { initialized, online, syncNow } = useSyncStore.getState();
      if (initialized && online) {
        await syncNow();
        habit = await selectHabit(id);
      }
    }
    if (!habit) throw new Error("Habit not found");
    return habit;
  },

  createHabit: async (input) => {
    const id = newId();
    const row: HabitRow = {
      ...localMeta(),
      id,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? "OTROS",
      priority: input.priority ?? 1,
      frequency: input.frequency ?? null,
      startDate: input.startDate ? new Date(input.startDate).toISOString() : new Date().toISOString(),
      endDate: input.endDate ? new Date(input.endDate).toISOString() : null,
      isArchived: false,
      streakCount: 0,
      categoryId: input.categoryId ?? null,
    };
    await putRow("habits", row);
    await enqueue({
      entity: "habit",
      action: "create",
      entityId: id,
      data: {
        name: row.name,
        description: row.description,
        category: row.category,
        priority: row.priority,
        frequency: row.frequency,
        startDate: row.startDate,
        endDate: row.endDate,
        categoryId: row.categoryId,
      },
    });
    useSyncStore.getState().scheduleSync();
    set({ habits: await selectHabits() });
    toast.success("Habit created");
  },

  updateHabit: async (id, input) => {
    const existing = await getRow<HabitRow>("habits", id);
    if (!existing) return;

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.isArchived !== undefined) data.isArchived = input.isArchived;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate).toISOString();
    if (input.endDate !== undefined) data.endDate = input.endDate ? new Date(input.endDate).toISOString() : null;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;

    await putRow("habits", { ...existing, ...data, updatedAt: new Date().toISOString() });
    await coalesceUpdate("habit", id, data, knownBaseVersion(existing.version));
    useSyncStore.getState().scheduleSync();
    set({ habits: await selectHabits() });
    toast.success("Habit updated");
  },

  deleteHabit: async (id) => {
    const existing = await getRow<HabitRow>("habits", id);
    const logs = await getAllRows<HabitLogRow>("habitLogs");
    await Promise.all(logs.filter((l) => l.habitId === id).map((l) => deleteRow("habitLogs", l.id)));
    await deleteRow("habits", id);
    // Cancel queued logs for a habit that only ever existed locally.
    await removePendingWhere("habitLog", (op) => op.data?.habitId === id);
    await enqueueDelete("habit", id, knownBaseVersion(existing?.version));
    useSyncStore.getState().scheduleSync();
    set({ habits: await selectHabits() });
    toast.success("Habit deleted");
  },

  checkIn: async (id, date, status) => {
    const targetDate = date || todayUtc();
    const resolvedStatus = status === "skipped" || status === "failed" ? status : "completed";

    const logs = await getAllRows<HabitLogRow>("habitLogs");
    const existing = logs.find((l) => l.habitId === id && l.date === targetDate);

    if (existing) {
      await putRow("habitLogs", { ...existing, status: resolvedStatus, updatedAt: new Date().toISOString() });
      await coalesceUpdate("habitLog", existing.id, { status: resolvedStatus }, knownBaseVersion(existing.version));
    } else {
      const logId = newId();
      await putRow("habitLogs", {
        ...localMeta(),
        id: logId,
        habitId: id,
        date: targetDate,
        status: resolvedStatus,
        note: null,
      });
      await enqueue({
        entity: "habitLog",
        action: "create",
        entityId: logId,
        data: { habitId: id, date: targetDate, status: resolvedStatus },
      });
    }

    useSyncStore.getState().scheduleSync();
    set({ habits: await selectHabits() });
  },

  undoCheckIn: async (id, date) => {
    const targetDate = date || todayUtc();
    const logs = await getAllRows<HabitLogRow>("habitLogs");
    const existing = logs.find((l) => l.habitId === id && l.date === targetDate);
    if (!existing) return;

    await deleteRow("habitLogs", existing.id);
    await enqueueDelete("habitLog", existing.id, knownBaseVersion(existing.version));
    useSyncStore.getState().scheduleSync();
    set({ habits: await selectHabits() });
  },

  resetProgress: async (id) => {
    const { initialized, online, syncNow } = useSyncStore.getState();
    if (!initialized || !online) {
      toast.error("Resetting progress requires a connection");
      return;
    }
    try {
      await client.post(`/habits/${id}/reset`);
      const logs = await getAllRows<HabitLogRow>("habitLogs");
      await Promise.all(logs.filter((l) => l.habitId === id).map((l) => deleteRow("habitLogs", l.id)));
      set({ habits: await selectHabits() });
      void syncNow();
      toast.success("Progress reset");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to reset progress";
      toast.error(msg);
    }
  },
}));

useSyncStore.subscribe((state, prev) => {
  if (state.dataVersion !== prev.dataVersion) {
    void selectHabits().then((habits) => {
      useHabitStore.setState({ habits });
      updateHabitData(habits);
    });
  }
});
