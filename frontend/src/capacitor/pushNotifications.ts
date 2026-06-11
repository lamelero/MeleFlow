import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import toast from "react-hot-toast";
import { isNative } from "./register";
import { client } from "../api/client";

export async function registerPushNotifications() {
  if (!isNative()) return;

  // Request permission
  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== "granted") {
    console.log("[push] permission denied");
    return;
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
}
