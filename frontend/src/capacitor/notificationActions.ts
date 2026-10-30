import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./register";
import { navigateTo } from "../lib/navigation";
import { logger } from "../lib/logger";
import i18n from "../i18n";

/** Action type that adds a "Complete" button to habit reminders. */
export const HABIT_ACTION_TYPE = "habit-reminder";

/** Notification payload key used to know where a tap should route. */
export interface NotificationExtra {
  kind?: "task" | "habit" | "event";
  id?: string;
}

function routeFor(kind?: NotificationExtra["kind"]): string | null {
  switch (kind) {
    case "habit":
      return "/app?view=habits";
    case "task":
      return "/app?view=tasks";
    case "event":
      return "/app?view=calendar";
    default:
      return null;
  }
}

/**
 * Registers notification action buttons and the tap handler.
 * - Tapping a notification routes to its section instead of the home screen.
 * - The "Complete" action on a habit reminder checks the habit in directly.
 */
export async function setupNotificationActions(): Promise<void> {
  if (!isNative()) return;

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: HABIT_ACTION_TYPE,
          actions: [
            { id: "complete", title: i18n.t("notifications.complete", "Complete") },
            { id: "skip", title: i18n.t("notifications.skip", "Skip") },
          ],
        },
      ],
    });
  } catch (err) {
    logger.debug("[notifications] registerActionTypes failed:", err);
  }

  await LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const actionId = event.actionId;
    const extra = (event.notification?.extra ?? {}) as NotificationExtra;

    if (actionId === "complete" && extra.kind === "habit" && extra.id) {
      try {
        // Imported lazily to avoid a module cycle (habit store -> scheduler).
        const { useHabitStore } = await import("../store/habitStore");
        await useHabitStore.getState().checkIn(extra.id);
      } catch (err) {
        console.error("[notifications] habit completion from notification failed:", err);
      }
      return;
    }

    if (actionId === "skip" && extra.kind === "habit" && extra.id) {
      try {
        const { useHabitStore } = await import("../store/habitStore");
        await useHabitStore.getState().checkIn(extra.id, undefined, "skipped");
      } catch (err) {
        console.error("[notifications] habit skip from notification failed:", err);
      }
      return;
    }

    const route = routeFor(extra.kind);
    if (route) navigateTo(route);
  });
}
