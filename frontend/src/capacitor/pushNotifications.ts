import { PushNotifications } from "@capacitor/push-notifications";
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
  await PushNotifications.register();

  // Listen for token
  PushNotifications.addListener("registration", async (token) => {
    console.log("[push] FCM token received");
    try {
      await client.post("/notifications/register-token", { token: token.value });
      console.log("[push] token sent to backend");
    } catch (err) {
      console.error("[push] failed to send token:", err);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error:", err);
  });

  // Handle foreground notifications
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[push] received in foreground:", notification);
  });
}
