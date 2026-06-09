import { LocalNotifications, Weekday } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { isNative } from "./register";

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

export async function scheduleTaskReminders(
  tasks: { id: string; title: string; dueDate?: string | null; reminderEnabled?: boolean; reminderConfig?: string | null }[]
) {
  if (!isNative()) return;

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
        }
      } else {
        continue;
      }
    } catch {
      continue;
    }

    for (const rem of reminders) {
      const [hourStr, minuteStr] = rem.time.split(":");
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (isNaN(hour) || isNaN(minute)) continue;

      if (rem.frequency === "always") {
        notifs.push({
          title: task.title,
          body: "",
          id: notifId++,
          schedule: { on: { hour, minute } },
          smallIcon: "ic_stat_icon",
          iconColor: "#14B8A6",
        });
      } else if (rem.frequency === "weekly" && rem.days && rem.days.length > 0) {
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
      } else if (rem.frequency === "before_due" && task.dueDate) {
        const due = new Date(task.dueDate);
        const at = new Date(due.getTime() - (rem.beforeDays ?? 0) * 24 * 60 * 60 * 1000);
        if (at > new Date()) {
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
