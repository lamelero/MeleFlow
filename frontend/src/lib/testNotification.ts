import { LocalNotifications } from "@capacitor/local-notifications";

export async function scheduleTestNotification(delayMs = 10000) {
  const at = new Date(Date.now() + delayMs);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "Test MeleFlow",
          body: `Scheduled ${delayMs / 1000}s ago`,
          id: 9999,
          schedule: { at },
          smallIcon: "ic_stat_icon",
          iconColor: "#14B8A6",
          channelId: "meleflow-default",
          sound: "default",
          attachments: undefined,
          actionTypeId: undefined,
          extra: undefined,
          largeBody: undefined,
          summaryText: undefined,
          group: undefined,
          groupSummary: undefined,
        },
      ],
    });
    console.log(`[testNotification] scheduled in ${delayMs / 1000}s at ${at.toISOString()}`);
    return true;
  } catch (err) {
    console.error("[testNotification] error:", err);
    return false;
  }
}
