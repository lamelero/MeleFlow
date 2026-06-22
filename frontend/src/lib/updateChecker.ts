const GITHUB_API = "https://api.github.com/repos/lamelero/MeleFlow/releases/latest";
const LAST_CHECK_KEY = "update_last_check";
const SKIPPED_VERSION_KEY = "update_skipped_version";
const CACHED_VERSION_KEY = "update_cached_version";
const CACHED_URL_KEY = "update_cached_url";
const ONE_DAY = 24 * 60 * 60 * 1000;

// Change this to "0.0.1" to test the update checker
const CURRENT_VERSION = "1.1.0";

export interface UpdateInfo {
  available: boolean;
  version: string;
  url: string;
}

function getCachedVersion(): string | null {
  try {
    return localStorage.getItem(CACHED_VERSION_KEY);
  } catch {
    return null;
  }
}

function getCachedUrl(): string | null {
  try {
    return localStorage.getItem(CACHED_URL_KEY);
  } catch {
    return null;
  }
}

function setCache(version: string, url: string) {
  try {
    localStorage.setItem(CACHED_VERSION_KEY, version);
    localStorage.setItem(CACHED_URL_KEY, url);
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch {}
}

export function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIPPED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function skipVersion(version: string) {
  try {
    localStorage.setItem(SKIPPED_VERSION_KEY, version);
  } catch {}
}

export function clearSkippedVersion() {
  try {
    localStorage.removeItem(SKIPPED_VERSION_KEY);
  } catch {}
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const now = Date.now();
  const lastCheck = (() => {
    try {
      return parseInt(localStorage.getItem(LAST_CHECK_KEY) || "0", 10);
    } catch {
      return 0;
    }
  })();

  // Use cache if checked within the last day
  if (now - lastCheck < ONE_DAY) {
    const cachedVersion = getCachedVersion();
    const cachedUrl = getCachedUrl();
    if (cachedVersion && cachedUrl) {
      return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl };
    }
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) {
      const cachedVersion = getCachedVersion();
      const cachedUrl = getCachedUrl();
      if (cachedVersion && cachedUrl) {
        return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl };
      }
      return { available: false, version: "", url: "" };
    }
    const data = await res.json();
    const version = (data.tag_name || "").replace(/^v/, "");
    const url = data.html_url || "";
    setCache(version, url);
    return { available: version !== CURRENT_VERSION && version !== "", version, url };
  } catch {
    const cachedVersion = getCachedVersion();
    const cachedUrl = getCachedUrl();
    if (cachedVersion && cachedUrl) {
      return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl };
    }
    return { available: false, version: "", url: "" };
  }
}
