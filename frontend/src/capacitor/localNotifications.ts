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

function fromDayIndex(idx: number): Weekday {
  const wd = (idx + 2) % 7;
  return (wd === 0 ? 7 : wd) as Weekday;
}

interface ReminderItem {
  id?: string;
  time: string;
  frequency: "always" | "weekly" | "before_due";
  days?: number[];
  beforeDays?: number;
}

function uiIndexToJsDay(uiIdx: number): number {
  return uiIdx === 6 ? 0 : uiIdx + 1;
}

export async function scheduleTaskReminders(
  tasks: { id: string; title: string; dueDate?: string | null; reminderEnabled?: boolean; reminderConfig?: string | null }[]
) {
  if (!isNative()) return;
  if (!(await hasPermission())) {
    console.warn("[localNotifications] no permission, skipping schedule");
    return;
  }

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  const notifs: LocalNotificationSchema[] = [];
  let notifId = 1;

  for (const task of tasks) {
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
        } else if (parsed.type === "monthly") {
          reminders.push({ time: parsed.reminderTime, frequency: "weekly", days: [new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] });
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
    const todayStart = new Date(todayUTC);
    const nowMs = now.getTime();

    for (const rem of reminders) {
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
          while (cursor.getTime() <= dueEnd.getTime()) {
            const at = new Date(cursor);
            notifs.push({
              title: task.title,
              body: "",
              id: notifId++,
              schedule: { at },
              smallIcon: "ic_stat_icon",
              iconColor: "#14B8A6",
            });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            cursor.setUTCHours(hour, minute, 0, 0);
          }
        } else {
          notifs.push({
            title: task.title,
            body: "",
            id: notifId++,
            schedule: { on: { hour, minute } },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
          });
        }
      } else if (rem.frequency === "weekly" && rem.days && rem.days.length > 0) {
        if (dueDate) {
          const dueUTC = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          if (dueUTC < todayUTC) continue;

          let cursor = new Date(todayUTC);
          cursor.setUTCHours(hour, minute, 0, 0);
          if (cursor.getTime() <= nowMs) cursor.setUTCDate(cursor.getUTCDate() + 1);

          const dueEnd = new Date(dueUTC);
          while (cursor.getTime() <= dueEnd.getTime()) {
            const uiIdx = cursor.getUTCDay() === 0 ? 6 : cursor.getUTCDay() - 1;
            if (rem.days.includes(uiIdx)) {
              const at = new Date(cursor);
              at.setUTCHours(hour, minute, 0, 0);
              notifs.push({
                title: task.title,
                body: "",
                id: notifId++,
                schedule: { at },
                smallIcon: "ic_stat_icon",
                iconColor: "#14B8A6",
              });
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            cursor.setUTCHours(hour, minute, 0, 0);
          }
        } else {
          for (const dayIdx of rem.days) {
            notifs.push({
              title: task.title,
              body: "",
              id: notifId++,
              schedule: { on: { hour, minute, weekday: fromDayIndex(dayIdx) } },
              smallIcon: "ic_stat_icon",
              iconColor: "#14B8A6",
            });
          }
        }
      } else if (rem.frequency === "before_due" && task.dueDate) {
        const due = new Date(task.dueDate);
        const at = new Date(due.getTime() - (rem.beforeDays ?? 0) * 24 * 60 * 60 * 1000);
        at.setUTCHours(hour, minute, 0, 0);
        if (at.getTime() > nowMs) {
          notifs.push({
            title: task.title,
            body: "",
            id: notifId++,
            schedule: { at },
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
          });
        }
      }
    }
  }

  if (notifs.length === 0) return;

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
  }
}
