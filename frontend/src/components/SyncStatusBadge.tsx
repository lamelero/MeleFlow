import { useTranslation } from "react-i18next";
import { AlertCircle, CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { useSyncStore } from "../sync/syncStore";

/**
 * Compact sync state pill. Visible only when there is something to report:
 * offline, syncing, pending local changes or a failed run.
 */
export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pending);
  const online = useSyncStore((s) => s.online);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const syncNow = useSyncStore((s) => s.syncNow);

  if (online && status === "idle" && pending === 0) return null;

  const lastSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString()
    : t("sync.never", "Never synced");

  let icon = <CloudUpload className="h-4 w-4" />;
  let label = t("sync.pending", { count: pending, defaultValue: "{{count}} pending" });
  let className = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  let title = t("sync.pendingHint", "Local changes waiting to be uploaded");

  if (!online) {
    icon = <CloudOff className="h-4 w-4" />;
    label = t("sync.offline", "Offline");
    className = "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
    title = t("sync.offlineHint", "You are offline. Changes are saved on this device.");
  } else if (status === "syncing") {
    icon = <RefreshCw className="h-4 w-4 animate-spin" />;
    label = t("sync.syncing", "Syncing");
    className = "bg-primary/10 text-primary-text";
    title = t("sync.syncingHint", "Synchronizing with the server");
  } else if (status === "error") {
    icon = <AlertCircle className="h-4 w-4" />;
    label = t("sync.error", "Sync failed");
    className = "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    title = t("sync.errorHint", "Tap to retry");
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={`${title} · ${t("sync.lastSync", "Last sync")}: ${lastSync}`}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-urbanist text-xs font-medium transition-colors ${className}`}
      aria-label={title}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
