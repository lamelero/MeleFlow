import { LocalNotifications } from "@capacitor/local-notifications";

let testId = 9999;

function nextId() {
  testId++;
  return testId;
}

export async function scheduleTestAt(delayMs = 10000) {
  const at = new Date(Date.now() + delayMs);
  const id = nextId();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: `Test at (${delayMs / 1000}s)`,
          body: `Trigger: ${at.toLocaleTimeString()}`,
          id,
          schedule: { at },
          smallIcon: "ic_stat_icon",
          iconColor: "#14B8A6",
          channelId: "meleflow-default",
          sound: "default",
        },
      ],
    });
    console.log(`[testNotification] at(${delayMs / 1000}s) id=${id} at ${at.toISOString()}`);
    return true;
  } catch (err) {
    console.error("[testNotification] at error:", err);
    return false;
  }
}

export async function scheduleTestOn() {
  const now = new Date();
  const minute = now.getMinutes();
  const targetMinute = (minute + 1) % 60;
  const targetHour = targetMinute === 0 ? now.getHours() + 1 : now.getHours();
  const id = nextId();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "Test on (:01)",
          body: `Next minute trigger`,
          id,
          schedule: { on: { hour: targetHour % 24, minute: targetMinute } },
          smallIcon: "ic_stat_icon",
          iconColor: "#14B8A6",
          channelId: "meleflow-default",
          sound: "default",
        },
      ],
    });
    console.log(`[testNotification] on(h:${targetHour % 24}, m:${targetMinute}) id=${id}`);
    return true;
  } catch (err) {
    console.error("[testNotification] on error:", err);
    return false;
  }
}

export async function clearTestNotifications() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 9999 }, { id: 10000 }, { id: 10001 }] });
  } catch { /* ignore */ }
}
