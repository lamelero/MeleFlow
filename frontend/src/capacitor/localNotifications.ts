import { LocalNotifications, Weekday } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { isNative } from "./register";

interface ReminderConfig {
  type: "daily" | "weekly";
  days: number[];
  reminderTime: string;
}

function fromDayIndex(idx: number): Weekday {
  const wd = (idx + 2) % 7;
  return (wd === 0 ? 7 : wd) as Weekday;
}

export async function scheduleTaskReminders(
  tasks: { id: string; title: string; reminderEnabled?: boolean; reminderConfig?: string | null }[]
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

    let config: ReminderConfig;
    try {
      config = JSON.parse(task.reminderConfig);
    } catch {
      continue;
    }
    if (!config.reminderTime) continue;
    const [hourStr, minuteStr] = config.reminderTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (isNaN(hour) || isNaN(minute)) continue;

    if (config.type === "daily") {
      notifs.push({
        title: task.title,
        body: "",
        id: notifId++,
        schedule: { on: { hour, minute } },
        smallIcon: "ic_stat_icon",
        iconColor: "#14B8A6",
      });
    } else if (config.type === "weekly" && config.days?.length > 0) {
      for (const dayIdx of config.days) {
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
