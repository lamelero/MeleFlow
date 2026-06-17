import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";

const backHandlers: (() => boolean)[] = [];

export function registerBackHandler(handler: () => boolean): () => void {
  backHandlers.unshift(handler);
  return () => {
    const idx = backHandlers.indexOf(handler);
    if (idx >= 0) backHandlers.splice(idx, 1);
  };
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    const granted = display === "granted";
    console.log("[notifications] permission:", granted ? "granted" : "denied");
    return granted;
  } catch (err) {
    console.error("[notifications] permission error:", err);
    return false;
  }
}

export async function createNotificationChannel() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: "meleflow-default",
      name: "MeleFlow",
      description: "Task and habit reminders",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
    console.log("[notifications] channel created");
  } catch (err) {
    console.error("[notifications] channel error:", err);
  }
}

export async function requestExactAlarmPermission() {
  if (!isNative()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === "granted") {
      console.log("[notifications] exact alarm permission: granted");
    }
  } catch {
    // SCHEDULE_EXACT_ALARM is declared in manifest
  }
}

export async function getServerUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: "serverUrl" });
  return value;
}

export async function setServerUrl(url: string): Promise<void> {
  await Preferences.set({ key: "serverUrl", value: url });
}

export async function setupStatusBar(isDark = true) {
  if (!isNative()) return;
  try {
    const StatusBar = (window as any).Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
      await StatusBar.setStyle({ style: isDark ? "DARK" : "LIGHT" });
      await StatusBar.setBackgroundColor({ color: "transparent" });
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    // StatusBar not available
  }
}

const FONT_SIZE_KEY = "fontSize";

export async function getFontSize(): Promise<string> {
  if (!isNative()) return "normal";
  const { value } = await Preferences.get({ key: FONT_SIZE_KEY });
  return value ?? "normal";
}

export async function setFontSize(size: string): Promise<void> {
  await Preferences.set({ key: FONT_SIZE_KEY, value: size });
}

const REFRESH_TOKEN_KEY = "refreshToken";

export async function getPersistedRefreshToken(): Promise<string | null> {
  if (!isNative()) return null;
  const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
  return value;
}

export async function setPersistedRefreshToken(token: string | null): Promise<void> {
  if (!isNative()) return;
  if (token) {
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
  } else {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  }
}

const BOLD_FONT_KEY = "boldFont";

export async function getBoldFont(): Promise<boolean> {
  if (!isNative()) return false;
  const { value } = await Preferences.get({ key: BOLD_FONT_KEY });
  return value === "true";
}

export async function setBoldFont(enabled: boolean): Promise<void> {
  await Preferences.set({ key: BOLD_FONT_KEY, value: enabled ? "true" : "false" });
}

export function setupAppListeners() {
  if (!isNative()) return;
  setupStatusBar();
  App.addListener("backButton", ({ canGoBack }) => {
    for (const handler of backHandlers) {
      if (handler()) return;
    }
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
}
