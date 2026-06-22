const GITHUB_API = "https://api.github.com/repos/lamelero/MeleFlow/releases/latest";
const LAST_CHECK_KEY = "update_last_check";
const SKIPPED_VERSION_KEY = "update_skipped_version";
const CACHED_VERSION_KEY = "update_cached_version";
const CACHED_URL_KEY = "update_cached_url";
const CACHED_DOWNLOAD_URL_KEY = "update_cached_download_url";
const ONE_DAY = 24 * 60 * 60 * 1000;

// Change this to "0.0.1" to test the update checker
const CURRENT_VERSION = "1.1.0";

export interface UpdateInfo {
  available: boolean;
  version: string;
  url: string;
  downloadUrl: string;
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

function getCachedDownloadUrl(): string | null {
  try {
    return localStorage.getItem(CACHED_DOWNLOAD_URL_KEY);
  } catch {
    return null;
  }
}

function setCache(version: string, url: string, downloadUrl: string) {
  try {
    localStorage.setItem(CACHED_VERSION_KEY, version);
    localStorage.setItem(CACHED_URL_KEY, url);
    localStorage.setItem(CACHED_DOWNLOAD_URL_KEY, downloadUrl);
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

function extractDownloadUrl(data: { assets?: { name: string; browser_download_url: string }[] }): string {
  if (!data.assets) return "";
  const apk = data.assets.find((a) => a.name.endsWith(".apk"));
  return apk?.browser_download_url || "";
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
    const cachedDownloadUrl = getCachedDownloadUrl();
    if (cachedVersion && cachedUrl) {
      return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
    }
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) {
      const cachedVersion = getCachedVersion();
      const cachedUrl = getCachedUrl();
      const cachedDownloadUrl = getCachedDownloadUrl();
      if (cachedVersion && cachedUrl) {
        return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
      }
      return { available: false, version: "", url: "", downloadUrl: "" };
    }
    const data = await res.json();
    const version = (data.tag_name || "").replace(/^v/, "");
    const url = data.html_url || "";
    const downloadUrl = extractDownloadUrl(data);
    setCache(version, url, downloadUrl);
    return { available: version !== CURRENT_VERSION && version !== "", version, url, downloadUrl };
  } catch {
    const cachedVersion = getCachedVersion();
    const cachedUrl = getCachedUrl();
    const cachedDownloadUrl = getCachedDownloadUrl();
    if (cachedVersion && cachedUrl) {
      return { available: cachedVersion !== CURRENT_VERSION, version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
    }
    return { available: false, version: "", url: "", downloadUrl: "" };
  }
}
