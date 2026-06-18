import { LocalNotifications, Weekday } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { isNative } from "./register";

async function hasPermission(): Promise<boolean> {
  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

export async function ensureChannel() {
  try {
    await LocalNotifications.createChannel({
      id: "meleflow-default",
      name: "MeleFlow",
      description: "Task and habit reminders",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
    });
  } catch (err) {
    console.warn("[localNotifications] channel creation error:", err);
  }
}

interface ReminderItem {
  id?: string;
  time: string;
  frequency: "always" | "weekly" | "before_due";
  days?: number[];
  beforeDays?: number;
}

function makeId(taskId: string, ri: number, day: number): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = ((h << 5) - h) + taskId.charCodeAt(i);
  return (Math.abs(h) % 900000) + ri * 100 + day + 100;
}

export async function scheduleTaskReminders(
  tasks: { id: string; title: string; dueDate?: string | null; reminderEnabled?: boolean; reminderConfig?: string | null; isCompleted?: boolean }[]
) {
  if (!isNative()) return;
  if (!(await hasPermission())) {
    console.warn("[localNotifications] no permission, skipping schedule");
    return;
  }

  await ensureChannel();

  // Cancel all existing to force clean reschedule
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
    console.log(`[localNotifications] cancelled ${pending.notifications.length} existing`);
  }

  const notifs: LocalNotificationSchema[] = [];

  for (const task of tasks) {
    if (task.isCompleted) continue;
    if (!task.reminderEnabled || !task.reminderConfig) continue;

    let reminders: ReminderItem[];
    try {
      const parsed = JSON.parse(task.reminderConfig);
      if (Array.isArray(parsed)) {
        reminders = parsed;
      } else if (parsed?.type && parsed?.reminderTime) {
        reminders = [];
        if (parsed.type === "daily") {
          reminders.push({ time: parsed.reminderTime, frequency: "always" });
        } else if (parsed.type === "weekly" && parsed.days?.length > 0) {
          reminders.push({ time: parsed.reminderTime, frequency: "weekly", days: parsed.days });
        }
      } else {
        continue;
      }
    } catch {
      continue;
    }

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const now = new Date();
    const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const nowMs = now.getTime();

    for (let ri = 0; ri < reminders.length; ri++) {
      const rem = reminders[ri];
      const [hourStr, minuteStr] = rem.time.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (isNaN(hour) || isNaN(minute)) continue;

      if (rem.frequency === "always") {
        if (dueDate) {
          const dueUTC = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          if (dueUTC < todayUTC) continue;

          let cursor = new Date(todayUTC);
          cursor.setUTCHours(hour, minute, 0, 0);
          if (cursor.getTime() <= nowMs) cursor.setUTCDate(cursor.getUTCDate() + 1);
          cursor.setUTCHours(hour, minute, 0, 0);

          const dueEnd = new Date(dueUTC);
          let dayOffset = 0;
          while (cursor.getTime() <= dueEnd.getTime()) {
            const at = new Date(cursor);
              notifs.push({
                title: task.title,
                body: `⏰ ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                id: makeId(task.id, ri, dayOffset),
                schedule: { at, allowWhileIdle: true },
              smallIcon: "ic_stat_icon",
              iconColor: "#14B8A6",
              channelId: "meleflow-default",
              sound: "default",
            });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            cursor.setUTCHours(hour, minute, 0, 0);
            dayOffset++;
          }
        } else {
          for (let d = 0; d < 30; d++) {
            const at = new Date(todayUTC);
            at.setUTCDate(at.getUTCDate() + d);
            at.setUTCHours(hour, minute, 0, 0);
            if (at.getTime() <= nowMs) continue;
              notifs.push({
                title: task.title,
                body: `📅 ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                id: makeId(task.id, ri, d),
                schedule: { at, allowWhileIdle: true },
              smallIcon: "ic_stat_icon",
              iconColor: "#14B8A6",
              channelId: "meleflow-default",
              sound: "default",
            });
          }
        }
      } else if (rem.frequency === "weekly" && rem.days && rem.days.length > 0) {
        if (dueDate) {
          const dueUTC = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          if (dueUTC < todayUTC) continue;

          let cursor = new Date(todayUTC);
          cursor.setUTCHours(hour, minute, 0, 0);
          if (cursor.getTime() <= nowMs) cursor.setUTCDate(cursor.getUTCDate() + 1);

          const dueEnd = new Date(dueUTC);
          let dayOffset = 0;
          while (cursor.getTime() <= dueEnd.getTime()) {
            const uiIdx = cursor.getUTCDay() === 0 ? 6 : cursor.getUTCDay() - 1;
            if (rem.days.includes(uiIdx)) {
              const at = new Date(cursor);
              at.setUTCHours(hour, minute, 0, 0);
              notifs.push({
                title: task.title,
                body: `📅 ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                id: makeId(task.id, ri, dayOffset),
                schedule: { at, allowWhileIdle: true },
                smallIcon: "ic_stat_icon",
                iconColor: "#14B8A6",
                channelId: "meleflow-default",
                sound: "default",
              });
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            cursor.setUTCHours(hour, minute, 0, 0);
            dayOffset++;
          }
        } else {
          for (let d = 0; d < 30; d++) {
            const at = new Date(todayUTC);
            at.setUTCDate(at.getUTCDate() + d);
            at.setUTCHours(hour, minute, 0, 0);
            if (at.getTime() <= nowMs) continue;
            const uiIdx = at.getUTCDay() === 0 ? 6 : at.getUTCDay() - 1;
            if (rem.days.includes(uiIdx)) {
              notifs.push({
                title: task.title,
                body: `📅 ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                id: makeId(task.id, ri, d),
                schedule: { at, allowWhileIdle: true },
                smallIcon: "ic_stat_icon",
                iconColor: "#14B8A6",
                channelId: "meleflow-default",
                sound: "default",
              });
            }
          }
        }
      } else if (rem.frequency === "before_due" && task.dueDate) {
        const due = new Date(task.dueDate);
        const at = new Date(due.getTime() - (rem.beforeDays ?? 0) * 24 * 60 * 60 * 1000);
        at.setUTCHours(hour, minute, 0, 0);
        if (at.getTime() > nowMs) {
          notifs.push({
            title: task.title,
              body: `📅 ${due.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`,
            id: makeId(task.id, ri, 0),
            schedule: { at },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
            channelId: "meleflow-default",
            sound: "default",
          });
        }
      }
    }
  }

  if (notifs.length === 0) {
    console.log("[localNotifications] no notifications to schedule");
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: notifs });
    console.log(`[localNotifications] scheduled ${notifs.length} notifications`);
  } catch (err) {
    console.error("[localNotifications] schedule error:", err);
  }
}

export async function clearAllNotifications() {
  if (!isNative()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
    console.log(`[localNotifications] cleared ${pending.notifications.length} notifications`);
  }
}

function eventNotifId(eventId: string): number {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = ((h << 5) - h) + eventId.charCodeAt(i);
  return (Math.abs(h) % 900000) + 90000;
}

export async function scheduleEventReminders(
  events: { id: string; title: string; startTime: string; isAllDay: boolean; reminderBefore: number; allDayReminderTime: string; sourceName: string }[]
) {
  if (!isNative()) return;
  if (!(await hasPermission())) return;

  await ensureChannel();

  // Cancel existing event notifications
  const pending = await LocalNotifications.getPending();
  const eventIds = new Set(events.map((e) => eventNotifId(e.id)));
  const toCancel = pending.notifications.filter((n) => eventIds.has(n.id));
  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
  }

  const notifs: LocalNotificationSchema[] = [];
  const now = new Date();

  for (const ev of events) {
    const id = eventNotifId(ev.id);
    const start = new Date(ev.startTime);
    if (start.getTime() <= now.getTime()) continue;

      if (ev.isAllDay && ev.allDayReminderTime) {
        const [hour, minute] = ev.allDayReminderTime.split(":").map(Number);
        const at = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), hour, minute, 0));
        if (at.getTime() > now.getTime()) {
          notifs.push({
            title: ev.title,
            body: `${ev.sourceName} — ${start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`,
            id,
            schedule: { at, allowWhileIdle: true },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
            channelId: "meleflow-default",
            sound: "default",
          });
        }
      } else if (ev.reminderBefore > 0) {
        const at = new Date(start.getTime() - ev.reminderBefore * 60 * 1000);
        if (at.getTime() > now.getTime()) {
          notifs.push({
            title: ev.title,
            body: `${ev.sourceName} — ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            id,
            schedule: { at, allowWhileIdle: true },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
            channelId: "meleflow-default",
            sound: "default",
          });
        }
      }
  }

  if (notifs.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications: notifs });
    console.log(`[localNotifications] scheduled ${notifs.length} event notifications`);
  } catch (err) {
    console.error("[localNotifications] event schedule error:", err);
  }
}
