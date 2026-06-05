import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./register";

interface TaskReminder {
  id: string;
  title: string;
  dueDate: string;
}

export async function scheduleTaskReminders(tasks: TaskReminder[]) {
  if (!isNative()) return;

  await LocalNotifications.cancel({ notifications: [{ id: 0 }] });

  const now = new Date();
  const upcoming = tasks.filter((t) => {
    const d = new Date(t.dueDate);
    return d > now && d.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  });

  const notifications = upcoming.map((task, i) => ({
    title: task.title,
    body: "Due within 24 hours",
    id: i + 1,
    schedule: { at: new Date(task.dueDate) },
    smallIcon: "ic_stat_icon",
    iconColor: "#8B5CF6",
  }));

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
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
