import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";

const backHandlers: (() => boolean)[] = [];
const SERVERS_KEY = "servers";
let activeServerId: string | null = null;

export interface ServerEntry {
  id: string;
  label: string;
  url: string;
}

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

const SERVER_URL_KEY = "serverUrl";

async function migrateOldServer() {
  const { value: oldUrl } = await Preferences.get({ key: SERVER_URL_KEY });
  const { value: serversJson } = await Preferences.get({ key: SERVERS_KEY });
  if (oldUrl && !serversJson) {
    const id = crypto.randomUUID();
    const servers: ServerEntry[] = [{ id, label: "Servidor 1", url: oldUrl }];
    await Preferences.set({ key: SERVERS_KEY, value: JSON.stringify(servers) });
    activeServerId = id;
    await Preferences.remove({ key: SERVER_URL_KEY });
  }
}

async function loadServers(): Promise<ServerEntry[]> {
  await migrateOldServer();
  const { value } = await Preferences.get({ key: SERVERS_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as ServerEntry[];
  } catch {
    return [];
  }
}

async function saveServers(servers: ServerEntry[]) {
  await Preferences.set({ key: SERVERS_KEY, value: JSON.stringify(servers) });
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function getServers(): Promise<ServerEntry[]> {
  const servers = await loadServers();
  if (servers.length > 0 && !activeServerId) {
    activeServerId = servers[0].id;
  }
  return servers;
}

export async function getActiveServer(): Promise<ServerEntry | null> {
  const servers = await loadServers();
  if (servers.length === 0) return null;
  if (!activeServerId) {
    activeServerId = servers[0].id;
  }
  return servers.find((s) => s.id === activeServerId) || servers[0];
}

export async function getServerUrl(): Promise<string | null> {
  const server = await getActiveServer();
  return server?.url || null;
}

export async function setServerUrl(url: string, label?: string): Promise<void> {
  const servers = await loadServers();
  const existing = servers.find((s) => s.url === url);
  if (existing) {
    if (label) existing.label = label;
    activeServerId = existing.id;
  } else {
    const id = genId();
    servers.push({ id, label: label || `Servidor ${servers.length + 1}`, url });
    activeServerId = id;
  }
  await saveServers(servers);
}

export async function addServer(label: string, url: string): Promise<string> {
  const servers = await loadServers();
  const id = genId();
  servers.push({ id, label, url });
  await saveServers(servers);
  activeServerId = id;
  return id;
}

export async function removeServer(id: string): Promise<void> {
  let servers = await loadServers();
  servers = servers.filter((s) => s.id !== id);
  await saveServers(servers);
  if (activeServerId === id) {
    activeServerId = servers.length > 0 ? servers[0].id : null;
  }
}

export async function setActiveServer(id: string): Promise<void> {
  activeServerId = id;
}

export async function updateServer(id: string, data: Partial<Pick<ServerEntry, "label" | "url">>): Promise<void> {
  const servers = await loadServers();
  const server = servers.find((s) => s.id === id);
  if (!server) return;
  if (data.label !== undefined) server.label = data.label;
  if (data.url !== undefined) server.url = data.url;
  await saveServers(servers);
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
