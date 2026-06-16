import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import toast from "react-hot-toast";
import { isNative } from "./register";
import { ensureChannel } from "./localNotifications";
import { client } from "../api/client";

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
    console.log("[push] token re-registered");
  } catch (err) {
    console.error("[push] re-register failed:", err);
  }
}

export async function registerPushNotifications() {
  if (!isNative()) return;

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

  if (!listenersReady) {
    listenersReady = true;

    PushNotifications.addListener("registration", async (token) => {
      console.log("[push] FCM token received");
      lastToken = token.value;
      await setStoredToken(token.value);
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

    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        reRegisterPushToken();
      }
    });
  }

  try {
    await PushNotifications.register();
    console.log("[push] registered with FCM");
  } catch (err) {
    console.error("[push] registration failed:", err);
    toast.error("Push registration failed");
  }
}
