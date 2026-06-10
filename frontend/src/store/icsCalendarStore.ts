import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";
import { updateIcsData } from "../lib/browserNotifications";

export interface IcsCalendar {
  id: string;
  userId: string;
  name: string;
  url: string;
  color: string;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalCalendarEvent {
  id: string;
  icsCalendarId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location: string | null;
  color: string;
  sourceName: string;
}

interface IcsCalendarState {
  calendars: IcsCalendar[];
  events: ExternalCalendarEvent[];
  loading: boolean;
  syncing: Set<string>;
  fetchCalendars: () => Promise<void>;
  addCalendar: (name: string, url: string, color: string) => Promise<void>;
  removeCalendar: (id: string) => Promise<void>;
  syncCalendar: (id: string) => Promise<void>;
  fetchEvents: (from: string, to: string) => Promise<void>;
}

export const useIcsCalendarStore = create<IcsCalendarState>((set, get) => ({
  calendars: [],
  events: [],
  loading: false,
  syncing: new Set(),

  fetchCalendars: async () => {
    try {
      const { data } = await client.get("/ics-calendars");
      set({ calendars: data });
    } catch {
      // silent
    }
  },

  addCalendar: async (name, url, color) => {
    try {
      const { data } = await client.post("/ics-calendars", { name, url, color });
      set((s) => ({ calendars: [...s.calendars, data] }));
      toast.success("Calendar feed added");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to add calendar feed";
      toast.error(msg);
      throw new Error(msg);
    }
  },

  removeCalendar: async (id) => {
    try {
      await client.delete(`/ics-calendars/${id}`);
      set((s) => ({
        calendars: s.calendars.filter((c) => c.id !== id),
        events: s.events.filter((e) => e.icsCalendarId !== id),
      }));
      toast.success("Calendar feed removed");
    } catch {
      toast.error("Failed to remove calendar feed");
    }
  },

  syncCalendar: async (id) => {
    const syncing = new Set(get().syncing);
    syncing.add(id);
    set({ syncing });
    try {
      await client.post(`/ics-calendars/${id}/sync`);
      toast.success("Calendar synced");
      const now = new Date().toISOString();
      set((s) => ({
        calendars: s.calendars.map((c) =>
          c.id === id ? { ...c, lastSyncedAt: now } : c,
        ),
      }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to sync calendar";
      toast.error(msg);
    } finally {
      const s = new Set(get().syncing);
      s.delete(id);
      set({ syncing: s });
    }
  },

  fetchEvents: async (from, to) => {
    try {
      const { data } = await client.get(
        `/ics-calendars/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      set({
        events: data.map(
          (e: {
            id: string;
            icsCalendarId: string;
            title: string;
            description: string | null;
            startTime: string;
            endTime: string;
            isAllDay: boolean;
            location: string | null;
            icsCalendar: { name: string; color: string };
          }) => ({
            id: e.id,
            icsCalendarId: e.icsCalendarId,
            title: e.title,
            description: e.description,
            startTime: e.startTime,
            endTime: e.endTime,
            isAllDay: e.isAllDay,
            location: e.location,
            color: e.icsCalendar.color,
            sourceName: e.icsCalendar.name,
          }),
        ),
      });
      updateIcsData(
        data.map((e: { id: string; title: string; startTime: string }) => ({
          id: e.id,
          summary: e.title,
          startDate: e.startTime,
        }))
      );
    } catch {
      // silent
    }
  },
}));
