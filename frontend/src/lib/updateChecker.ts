const GITHUB_API = "https://api.github.com/repos/lamelero/MeleFlow/releases/latest";
const RAW_APK_BASE = "https://github.com/lamelero/MeleFlow/raw/main/releases";
const LAST_CHECK_KEY = "update_last_check";
const SKIPPED_VERSION_KEY = "update_skipped_version";
const CACHED_VERSION_KEY = "update_cached_version";
const CACHED_URL_KEY = "update_cached_url";
const CACHED_DOWNLOAD_URL_KEY = "update_cached_download_url";
const APP_VERSION_KEY = "update_app_version";
const ONE_DAY = 24 * 60 * 60 * 1000;

// Injected at build time (see `define` in vite.config.ts): the Docker release
// build passes APP_VERSION (the git tag); local/native builds fall back to the
// package.json version. Override locally to test the update checker.
const CURRENT_VERSION = __APP_VERSION__;

export interface UpdateInfo {
  available: boolean;
  version: string;
  url: string;
  downloadUrl: string;
}

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Pre-release tag (e.g. "beta.1"), or null for a final release. */
  pre: string | null;
}

/**
 * Parses `X.Y.Z` or `X.Y.Z-pre` (an optional leading `v` is ignored).
 * Returns null when the string has no usable numeric core (e.g. "dev").
 */
export function parseVersion(version: string): ParsedVersion | null {
  const m = version.trim().replace(/^v/, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.+))?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2] ?? 0),
    patch: Number(m[3] ?? 0),
    pre: m[4] ?? null,
  };
}

/**
 * Compares two versions: >0 if `a` is newer, <0 if older, 0 if equal or
 * unparseable (unparseable versions never trigger an update offer).
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  // A final release outranks its pre-releases (1.3.1 > 1.3.1-beta).
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

/** True only when `remote` is strictly newer than `current`. */
export function isNewer(remote: string, current: string): boolean {
  return compareVersions(remote, current) > 0;
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

function extractDownloadUrl(data: { assets?: { name: string; browser_download_url: string }[] }, version: string): string {
  if (data.assets) {
    const apk = data.assets.find((a) => a.name.endsWith(".apk"));
    if (apk?.browser_download_url) return apk.browser_download_url;
  }
  return `${RAW_APK_BASE}/MeleFlow-v${version}.apk`;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  // If the app version changed (app was updated), invalidate cache
  const lastAppVersion = (() => {
    try {
      return localStorage.getItem(APP_VERSION_KEY);
    } catch { return null; }
  })();
  if (lastAppVersion !== CURRENT_VERSION) {
    try {
      localStorage.removeItem(CACHED_VERSION_KEY);
      localStorage.removeItem(CACHED_URL_KEY);
      localStorage.removeItem(CACHED_DOWNLOAD_URL_KEY);
      localStorage.removeItem(LAST_CHECK_KEY);
      localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
    } catch {}
  }

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
      return { available: isNewer(cachedVersion, CURRENT_VERSION), version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
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
        return { available: isNewer(cachedVersion, CURRENT_VERSION), version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
      }
      return { available: false, version: "", url: "", downloadUrl: "" };
    }
    const data = await res.json();
    const version = (data.tag_name || "").replace(/^v/, "");
    const url = data.html_url || "";
    const downloadUrl = extractDownloadUrl(data, version);
    setCache(version, url, downloadUrl);
    return { available: isNewer(version, CURRENT_VERSION), version, url, downloadUrl };
  } catch {
    const cachedVersion = getCachedVersion();
    const cachedUrl = getCachedUrl();
    const cachedDownloadUrl = getCachedDownloadUrl();
    if (cachedVersion && cachedUrl) {
      return { available: isNewer(cachedVersion, CURRENT_VERSION), version: cachedVersion, url: cachedUrl, downloadUrl: cachedDownloadUrl || "" };
    }
    return { available: false, version: "", url: "", downloadUrl: "" };
  }
}
