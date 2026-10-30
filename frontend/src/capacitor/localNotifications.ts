import { LocalNotifications, Weekday } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { isNative } from "./register";
import { logger } from "../lib/logger";
import { HABIT_ACTION_TYPE } from "./notificationActions";

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
  tasks: { id: string; title: string; dueDate?: string | null; reminderEnabled?: boolean; reminderConfig?: string | null; isCompleted?: boolean; kind?: "task" | "habit" }[]
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
    logger.debug(`[localNotifications] cancelled ${pending.notifications.length} existing`);
  }

  const notifs: LocalNotificationSchema[] = [];
  // All date maths happens in the device's local time zone: reminder times are
  // wall-clock times ("09:00 means 09:00 here"), so using UTC shifted them.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const task of tasks) {
    if (task.isCompleted) continue;
    if (!task.reminderEnabled || !task.reminderConfig) continue;

    // Reminders are tagged so a tap can route to the right section, and habit
    // reminders get action buttons (complete / skip).
    const kind: "task" | "habit" = task.kind === "habit" ? "habit" : "task";
    const extra = { kind, id: task.id };
    const actionTypeId = kind === "habit" ? HABIT_ACTION_TYPE : undefined;

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

    for (let ri = 0; ri < reminders.length; ri++) {
      const rem = reminders[ri];
      const [hourStr, minuteStr] = rem.time.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (isNaN(hour) || isNaN(minute)) continue;

      const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      const push = (at: Date, body: string, dayOffset: number) => {
        notifs.push({
          title: task.title,
          body,
          id: makeId(task.id, ri, dayOffset),
          schedule: { at, allowWhileIdle: true },
          smallIcon: "ic_stat_icon",
          iconColor: "#14B8A6",
          channelId: "meleflow-default",
          sound: "default",
          extra,
          ...(actionTypeId ? { actionTypeId } : {}),
        });
      };

      // Default window is the next 31 days; with a due date it stops that day.
      const windowEnd = dueDate
        ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        : new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 31);

      if (rem.frequency === "before_due" && dueDate) {
        const at = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), hour, minute);
        at.setDate(at.getDate() - (rem.beforeDays ?? 0));
        if (at.getTime() > now.getTime()) {
          push(at, `📅 ${dueDate.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`, 0);
        }
        continue;
      }

      const daysSet = rem.frequency === "weekly" && rem.days ? new Set(rem.days) : null;

      for (let d = 0; d <= 31; d++) {
        const day = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + d);
        if (day.getTime() > windowEnd.getTime()) break;

        // UI weekday index: Monday = 0 ... Sunday = 6.
        const uiIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
        if (daysSet && !daysSet.has(uiIdx)) continue;

        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
        if (at.getTime() <= now.getTime()) continue;

        push(at, `⏰ ${timeLabel}`, d);
      }
    }
  }

  if (notifs.length === 0) {
    logger.debug("[localNotifications] no notifications to schedule");
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: notifs });
    logger.debug(`[localNotifications] scheduled ${notifs.length} notifications`);
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
    logger.debug(`[localNotifications] cleared ${pending.notifications.length} notifications`);
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
        const at = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour, minute, 0);
        if (at.getTime() > now.getTime()) {
          notifs.push({
            title: ev.title,
            body: `${ev.sourceName} — ${start.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`,
            id,
            schedule: { at, allowWhileIdle: true },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
            extra: { kind: "event", id: ev.id },
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
            extra: { kind: "event", id: ev.id },
            channelId: "meleflow-default",
            sound: "default",
          });
        }
      }
  }

  if (notifs.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications: notifs });
    logger.debug(`[localNotifications] scheduled ${notifs.length} event notifications`);
  } catch (err) {
    console.error("[localNotifications] event schedule error:", err);
  }
}
