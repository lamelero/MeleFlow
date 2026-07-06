export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  browser: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { email: true, push: true, browser: true };

export function parseNotificationPrefs(prefs: string | null | undefined): NotificationPrefs {
  if (!prefs) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(prefs);
    return {
      email: parsed.email !== false,
      push: parsed.push !== false,
      browser: parsed.browser !== false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
