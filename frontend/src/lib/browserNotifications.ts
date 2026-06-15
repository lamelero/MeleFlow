import { useAuthStore } from "../store/authStore";

let timers: number[] = [];
let cachedTasks: TaskLike[] = [];
let cachedHabits: HabitLike[] = [];
let cachedIcs: IcsEventLike[] = [];

export function requestBrowserPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!("Notification" in window)) {
      console.warn("[browserNotifications] Notifications not supported");
      resolve(false);
      return;
    }
    if (Notification.permission === "granted") {
      resolve(true);
      return;
    }
    if (Notification.permission === "denied") {
      resolve(false);
      return;
    }
    Notification.requestPermission().then((result) => {
      resolve(result === "granted");
    });
  });
}

export function testBrowserNotification(): boolean {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  try {
    new Notification("MeleFlow", {
      body: "Browser notifications work!",
      icon: "/logo192.png",
    });
    return true;
  } catch (err) {
    console.error("[browserNotifications] test error:", err);
    return false;
  }
}

export function getDiagnostics() {
  const prefs = useAuthStore.getState().user?.notificationPrefs;
  const tasksWithReminders = cachedTasks.filter((t) => t.reminderEnabled).length;
  const taskRems = computeTaskReminders(cachedTasks);
  const habitRems = computeHabitReminders(cachedHabits);
  const icsRems = computeIcsReminders(cachedIcs);
  const all = [...taskRems, ...habitRems, ...icsRems].sort((a, b) => a.nextTime.getTime() - b.nextTime.getTime());
  return {
    browserPref: prefs?.browser ?? true,
    tasksWithReminders,
    cachedTasks: cachedTasks.length,
    cachedHabits: cachedHabits.length,
    cachedIcs: cachedIcs.length,
    remindersGenerated: all.length,
    nextTitle: all[0]?.title ?? null,
    nextIn: all[0] ? Math.round((all[0].nextTime.getTime() - Date.now()) / 1000) + "s" : null,
    activeTimers: timers.length,
  };
}

interface BrowserReminder {
  title: string;
  body: string;
  nextTime: Date;
}

interface TaskLike {
  id: string;
  title: string;
  reminderEnabled?: boolean;
  reminderConfig?: string | null;
  dueDate?: string | null;
}

interface HabitLike {
  id: string;
  name: string;
  frequency?: string | null;
}

interface IcsEventLike {
  id: string;
  summary: string;
  startDate: string;
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h, minute: m };
}

function getNextDaily(hour: number, minute: number, dueDate?: Date | null): Date | null {
  const now = new Date();
  const next = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  if (dueDate && next.getTime() > dueDate.getTime()) return null;
  return next;
}

function getNextWeekly(hour: number, minute: number, days: number[], dueDate?: Date | null): Date | null {
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const next = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0));
    next.setUTCDate(next.getUTCDate() + i);
    if (next.getTime() <= now.getTime()) continue;
    const uiIdx = next.getUTCDay() === 0 ? 6 : next.getUTCDay() - 1;
    if (days.includes(uiIdx)) {
      if (dueDate && next.getTime() > dueDate.getTime()) return null;
      return next;
    }
  }
  return null;
}

function getNextBeforeDue(hour: number, minute: number, beforeDays: number, dueDate: Date): Date | null {
  const at = new Date(dueDate.getTime() - beforeDays * 86400000);
  at.setUTCHours(hour, minute, 0, 0);
  return at.getTime() > Date.now() ? at : null;
}

function computeTaskReminders(tasks: TaskLike[]): BrowserReminder[] {
  const result: BrowserReminder[] = [];
  for (const t of tasks) {
    if (!t.reminderEnabled || !t.reminderConfig) continue;
    try {
      const parsed = JSON.parse(t.reminderConfig);
      const items: { time: string; frequency: string; days?: number[]; beforeDays?: number }[] = Array.isArray(parsed)
        ? parsed
        : parsed?.type && parsed?.reminderTime
          ? parsed.type === "daily"
            ? [{ time: parsed.reminderTime, frequency: "always" }]
            : parsed.type === "weekly" && parsed.days?.length
              ? [{ time: parsed.reminderTime, frequency: "weekly", days: parsed.days }]
              : []
          : [];
      const due = t.dueDate ? new Date(t.dueDate) : null;
      for (const item of items) {
        const { hour, minute } = parseTime(item.time);
        let next: Date | null = null;
        if (item.frequency === "always") next = getNextDaily(hour, minute, due);
        else if (item.frequency === "weekly" && item.days?.length) next = getNextWeekly(hour, minute, item.days, due);
        else if (item.frequency === "before_due" && due) next = getNextBeforeDue(hour, minute, item.beforeDays ?? 0, due);
        if (next) result.push({ title: t.title, body: "Task reminder", nextTime: next });
      }
    } catch { /* skip */ }
  }
  return result;
}

function computeHabitReminders(habits: HabitLike[]): BrowserReminder[] {
  const result: BrowserReminder[] = [];
  for (const h of habits) {
    if (!h.frequency) continue;
    try {
      const freq = JSON.parse(h.frequency);
      if (!freq.reminderTime) continue;
      const { hour, minute } = parseTime(freq.reminderTime);
      let next: Date | null = null;
      if (freq.type === "daily") next = getNextDaily(hour, minute);
      else if (freq.type === "weekly" && freq.days?.length) next = getNextWeekly(hour, minute, freq.days);
      if (next) result.push({ title: h.name, body: "Habit reminder", nextTime: next });
    } catch { /* skip */ }
  }
  return result;
}

function computeIcsReminders(events: IcsEventLike[], beforeMinutes = 5): BrowserReminder[] {
  const result: BrowserReminder[] = [];
  const now = Date.now();
  for (const ev of events) {
    const start = new Date(ev.startDate);
    const at = new Date(start.getTime() - beforeMinutes * 60000);
    if (at.getTime() > now && at.getTime() - now < 86400000) {
      result.push({ title: ev.summary, body: "Upcoming event", nextTime: at });
    }
  }
  return result;
}

function scheduleAll() {
  timers.forEach(clearTimeout);
  timers = [];

  // Respect notification preferences
  const prefs = useAuthStore.getState().user?.notificationPrefs;
  if (prefs && prefs.browser === false) {
    console.log("[browserNotifications] browser notifications disabled by user");
    return;
  }

  const rems = [...computeTaskReminders(cachedTasks), ...computeHabitReminders(cachedHabits), ...computeIcsReminders(cachedIcs)];
  const now = Date.now();
  for (const rem of rems) {
    const ms = rem.nextTime.getTime() - now;
    if (ms > 5000 && ms < 86400000) {
      const id = window.setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification(rem.title, { body: rem.body, icon: "/logo192.png" });
        }
      }, ms);
      timers.push(id);
    }
  }
}

export function updateTaskData(data: TaskLike[]) {
  cachedTasks = data;
  scheduleAll();
}

export function updateHabitData(data: HabitLike[]) {
  cachedHabits = data;
  scheduleAll();
}

export function updateIcsData(data: IcsEventLike[]) {
  cachedIcs = data;
  scheduleAll();
}

export function cancelBrowserReminders() {
  timers.forEach(clearTimeout);
  timers = [];
  cachedTasks = [];
  cachedHabits = [];
  cachedIcs = [];
}
