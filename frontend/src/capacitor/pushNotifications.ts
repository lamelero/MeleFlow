import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import toast from "react-hot-toast";
import { isNative } from "./register";
import { ensureChannel } from "./localNotifications";
import { client } from "../api/client";

let lastToken: string | null = null;

export async function reRegisterPushToken() {
  if (!isNative()) return;
  try {
    await PushNotifications.register();
    console.log("[push] re-register requested");
  } catch (err) {
    console.warn("[push] re-register failed:", err);
  }
}

export async function registerPushNotifications() {
  if (!isNative()) return;

  // Use LocalNotifications permission (POST_NOTIFICATIONS on Android 13+)
  // PushNotifications.checkPermissions() may not check the same permission
  let permStatus = await LocalNotifications.checkPermissions();
  if (permStatus.display === "denied") {
    console.log("[push] notification permission denied");
    return;
  }
  if (permStatus.display === "prompt") {
    permStatus = await LocalNotifications.requestPermissions();
    if (permStatus.display !== "granted") {
      console.log("[push] permission not granted");
      return;
    }
  }

  // Register with FCM
  try {
    await PushNotifications.register();
    console.log("[push] registered with FCM");
  } catch (err) {
    console.error("[push] registration failed:", err);
    toast.error("Push registration failed");
    return;
  }

  // Listen for token
  PushNotifications.addListener("registration", async (token) => {
    console.log("[push] FCM token received");
    lastToken = token.value;
    await ensureChannel();
    try {
      await client.post("/notifications/register-token", { token: token.value });
      console.log("[push] token sent to backend");
      toast.success("Push notifications ready", { duration: 2000 });
    } catch (err) {
      console.error("[push] failed to send token:", err);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error:", err);
  });

  // Handle foreground notifications
  PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    console.log("[push] received in foreground:", notification);
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
        }],
      });
    } catch (err) {
      console.error("[push] foreground display error:", err);
    }
  });

  // Re-register token when app comes to foreground
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive && lastToken) {
      reRegisterPushToken();
    }
  });
}
