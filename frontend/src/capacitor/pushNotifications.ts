import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import toast from "react-hot-toast";
import { isNative } from "./register";
import { ensureChannel } from "./localNotifications";
import { client } from "../api/client";
import { logger } from "../lib/logger";
import { navigateTo } from "../lib/navigation";

const PUSH_TOKEN_KEY = "meleflow_push_token";

let lastToken: string | null = null;
let listenersReady = false;

async function getStoredToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: PUSH_TOKEN_KEY });
    return value || null;
  } catch {
    return null;
  }
}

async function setStoredToken(token: string) {
  try {
    await Preferences.set({ key: PUSH_TOKEN_KEY, value: token });
  } catch {}
}

export async function reRegisterPushToken() {
  if (!isNative()) return;

  const token = lastToken || await getStoredToken();
  if (!token) return;

  try {
    await client.post("/notifications/register-token", { token });
    logger.debug("[push] token re-registered");
  } catch (err) {
    console.error("[push] re-register failed:", err);
  }
}

export async function registerPushNotifications() {
  if (!isNative()) return;

  let permStatus = await LocalNotifications.checkPermissions();
  if (permStatus.display === "denied") {
    logger.debug("[push] notification permission denied");
    return;
  }
  if (permStatus.display === "prompt") {
    permStatus = await LocalNotifications.requestPermissions();
    if (permStatus.display !== "granted") {
      logger.debug("[push] permission not granted");
      return;
    }
  }

  if (!listenersReady) {
    listenersReady = true;

    PushNotifications.addListener("registration", async (token) => {
      logger.debug("[push] FCM token received");
      lastToken = token.value;
      await setStoredToken(token.value);
      await ensureChannel();
      try {
        await client.post("/notifications/register-token", { token: token.value });
        logger.debug("[push] token sent to backend");
        toast.success("Push notifications ready", { duration: 2000 });
      } catch (err) {
        console.error("[push] failed to send token:", err);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[push] registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      const data = (notification.data ?? {}) as Record<string, unknown>;

      // Silent "sync nudge": re-arm reminders by syncing, show nothing.
      if (data.type === "sync") {
        logger.debug("[push] sync nudge received");
        const { useSyncStore } = await import("../sync/syncStore");
        void useSyncStore.getState().syncNow();
        return;
      }

      logger.debug("[push] received in foreground:", notification);
      try {
        await LocalNotifications.schedule({
          notifications: [{
            title: notification.title || "MeleFlow",
            body: notification.body || "",
            id: Math.floor(Math.random() * 100000) + 90000,
            smallIcon: "ic_stat_icon",
            iconColor: "#14B8A6",
            channelId: "meleflow-default",
            sound: "default",
            // Carry the routing hint so a tap opens the right section.
            extra: notification.data ?? undefined,
          }],
        });
      } catch (err) {
        console.error("[push] foreground display error:", err);
      }
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const kind = (action.notification?.data as { kind?: string } | undefined)?.kind;
      const route =
        kind === "habit" ? "/app?view=habits" :
        kind === "event" ? "/app?view=calendar" :
        kind === "task" ? "/app?view=tasks" : null;
      if (route) navigateTo(route);
    });

    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        reRegisterPushToken();
      }
    });
  }

  try {
    await PushNotifications.register();
    logger.debug("[push] registered with FCM");
  } catch (err) {
    console.error("[push] registration failed:", err);
    toast.error("Push registration failed");
  }
}
