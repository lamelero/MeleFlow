import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const { display } = await LocalNotifications.requestPermissions();
  return display === "granted";
}

export async function getServerUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: "serverUrl" });
  return value;
}

export async function setServerUrl(url: string): Promise<void> {
  await Preferences.set({ key: "serverUrl", value: url });
}

export async function setupStatusBar() {
  if (!isNative()) return;
  try {
    const StatusBar = (window as any).Capacitor?.Plugins?.StatusBar;
    if (StatusBar) {
      await StatusBar.setStyle({ style: "DARK" });
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
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });
}
