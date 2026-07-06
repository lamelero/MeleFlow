import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { useAdminStore } from "../../store/adminStore";
import { useBrandingStore } from "../../store/brandingStore";
import StatsCards from "../../components/admin/StatsCards";
import UsersTable from "../../components/admin/UsersTable";
import AppLayout from "../../components/AppLayout";
import { getAccessToken } from "../../api/client";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    stats, settings, fetchUsers, fetchStats, fetchSettings, updateSettings,
    testEmail, error, clearError,
    backups, backupSettings, backupCreating,
    fetchBackups, fetchBackupSettings, createBackup, deleteBackup, restoreBackup,
    updateBackupSettings,
  } = useAdminStore();
  const [localUploadSize, setLocalUploadSize] = useState(settings.maxUploadSize);
  const [localStorageQuota, setLocalStorageQuota] = useState(Math.round(settings.maxStoragePerUser / (1024 * 1024 * 1024)));
  const [localMaxAttempts, setLocalMaxAttempts] = useState(settings.maxLoginAttempts);
  const [localLockoutMinutes, setLocalLockoutMinutes] = useState(settings.loginLockoutMinutes);
  const [localFrontendUrl, setLocalFrontendUrl] = useState(settings.frontendUrl);

  // Email settings local state
  const [localSmtpHost, setLocalSmtpHost] = useState(settings.smtpHost);
  const [localSmtpPort, setLocalSmtpPort] = useState(settings.smtpPort);
  const [localSmtpUser, setLocalSmtpUser] = useState(settings.smtpUser);
  const [localSmtpPassword, setLocalSmtpPassword] = useState("");
  const [localFromEmail, setLocalFromEmail] = useState(settings.fromEmail);
  const [localEmailSubject, setLocalEmailSubject] = useState(settings.emailSubject);
  const [localEmailEnabled, setLocalEmailEnabled] = useState(settings.emailEnabled);
  const logoLightInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const [logoUploadingLight, setLogoUploadingLight] = useState(false);
  const [logoUploadingDark, setLogoUploadingDark] = useState(false);
  const { fetchLogo } = useBrandingStore();
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipePassword, setWipePassword] = useState("");
  const [wipeCountdown, setWipeCountdown] = useState(10);
  const [wipeConfirmEnabled, setWipeConfirmEnabled] = useState(false);
  const [wipeRunning, setWipeRunning] = useState(false);
  const wipeTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const handleLogoSelectLight = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploadingLight(true);
    try {
      await useAdminStore.getState().uploadLogo(file, "light");
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploadingLight(false);
    if (logoLightInputRef.current) logoLightInputRef.current.value = "";
  }, [fetchLogo]);

  const handleLogoRemoveLight = useCallback(async () => {
    setLogoUploadingLight(true);
    try {
      await useAdminStore.getState().removeLogo("light");
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploadingLight(false);
  }, [fetchLogo]);

  const handleLogoSelectDark = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploadingDark(true);
    try {
      await useAdminStore.getState().uploadLogo(file, "dark");
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploadingDark(false);
    if (logoDarkInputRef.current) logoDarkInputRef.current.value = "";
  }, [fetchLogo]);

  const handleLogoRemoveDark = useCallback(async () => {
    setLogoUploadingDark(true);
    try {
      await useAdminStore.getState().removeLogo("dark");
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploadingDark(false);
  }, [fetchLogo]);

  function handleOpenWipeModal() {
    setWipeModalOpen(true);
    setWipePassword("");
    setWipeCountdown(10);
    setWipeConfirmEnabled(false);
    setWipeRunning(false);
    if (wipeTimerRef.current) clearInterval(wipeTimerRef.current);
    wipeTimerRef.current = setInterval(() => {
      setWipeCountdown((prev) => {
        if (prev <= 1) {
          if (wipeTimerRef.current) clearInterval(wipeTimerRef.current);
          setWipeConfirmEnabled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleCloseWipeModal() {
    setWipeModalOpen(false);
    if (wipeTimerRef.current) clearInterval(wipeTimerRef.current);
  }

  async function handleConfirmWipe() {
    if (!wipePassword) return;
    setWipeRunning(true);
    try {
      await useAdminStore.getState().wipeAllData(wipePassword);
      toast.success(t("admin.wipeSuccess"));
      handleCloseWipeModal();
      setTimeout(() => { window.location.href = "/register"; }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t("admin.wipeFailed");
      toast.error(msg);
      setWipeRunning(false);
    }
  }

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchSettings();
    fetchBackups();
    fetchBackupSettings();
  }, [fetchStats, fetchUsers, fetchSettings, fetchBackups, fetchBackupSettings]);

  useEffect(() => {
    setLocalUploadSize(settings.maxUploadSize);
    setLocalStorageQuota(Math.round(settings.maxStoragePerUser / (1024 * 1024 * 1024)));
    setLocalMaxAttempts(settings.maxLoginAttempts);
    setLocalLockoutMinutes(settings.loginLockoutMinutes);
    setLocalSmtpHost(settings.smtpHost);
    setLocalSmtpPort(settings.smtpPort);
    setLocalSmtpUser(settings.smtpUser);
    setLocalFromEmail(settings.fromEmail);
    setLocalEmailSubject(settings.emailSubject);
    setLocalEmailEnabled(settings.emailEnabled);
    setLocalFrontendUrl(settings.frontendUrl);
  }, [settings]);

  function saveEmailSettings() {
    updateSettings({
      smtpHost: localSmtpHost,
      smtpPort: localSmtpPort,
      smtpUser: localSmtpUser,
      smtpPassword: localSmtpPassword || undefined,
      fromEmail: localFromEmail,
      emailSubject: localEmailSubject,
      emailEnabled: localEmailEnabled,
    });
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <p className="font-urbanist text-sm text-red-500 dark:text-red-400">
            {t("admin.accessDenied")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title={t("admin.title")}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >

      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("admin.backToApp")}
        </Link>

        {error && (
          <div className="flex items-center justify-between rounded-2xl bg-red-50 px-5 py-3 ring-1 ring-red-200 dark:bg-red-900/20 dark:ring-red-800/30">
            <span className="font-urbanist text-sm text-red-700 dark:text-red-400">{error}</span>
            <button
              onClick={clearError}
              className="text-sm text-red-500 hover:text-red-700 dark:text-red-400"
            >
              {t("admin.dismiss")}
            </button>
          </div>
        )}

        <StatsCards stats={stats} />

        {/* General Settings */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("admin.settings")}
          </h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.allowRegistration")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.allowRegistrationDesc")}
                </p>
              </div>
              <button
                onClick={() =>
                  updateSettings({ allowRegistration: !settings.allowRegistration })
                }
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  settings.allowRegistration ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform dark:bg-gray-200 ${
                    settings.allowRegistration ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.maxUploadSize")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.maxUploadSizeDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={localUploadSize}
                  onChange={(e) => setLocalUploadSize(Number(e.target.value))}
                  className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => {
                    if (localUploadSize >= 1 && localUploadSize <= 200) {
                      updateSettings({ maxUploadSize: localUploadSize });
                    } else {
                      toast.error(t("admin.mustBeRange", { min: 1, max: 200 }));
                    }
                  }}
                  disabled={localUploadSize === settings.maxUploadSize}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("admin.save")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.storageQuota")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.storageQuotaDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={localStorageQuota}
                  onChange={(e) => setLocalStorageQuota(Number(e.target.value))}
                  className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => {
                    const gb = Math.max(1, Math.min(1024, localStorageQuota));
                    setLocalStorageQuota(gb);
                    updateSettings({ maxStoragePerUser: gb * 1024 * 1024 * 1024 });
                  }}
                  disabled={localStorageQuota === Math.round(settings.maxStoragePerUser / (1024 * 1024 * 1024))}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("admin.save")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.maxLoginAttempts")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.maxLoginAttemptsDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={localMaxAttempts}
                  onChange={(e) => setLocalMaxAttempts(Number(e.target.value))}
                  className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => updateSettings({ maxLoginAttempts: localMaxAttempts })}
                  disabled={localMaxAttempts === settings.maxLoginAttempts}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("admin.save")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.lockoutDuration")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.lockoutDurationDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={localLockoutMinutes}
                  onChange={(e) => setLocalLockoutMinutes(Number(e.target.value))}
                  className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => updateSettings({ loginLockoutMinutes: localLockoutMinutes })}
                  disabled={localLockoutMinutes === settings.loginLockoutMinutes}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("admin.save")}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("admin.frontendUrl")}
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  {t("admin.frontendUrlDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localFrontendUrl}
                  onChange={(e) => setLocalFrontendUrl(e.target.value)}
                  placeholder={t("admin.frontendUrlPlaceholder")}
                  className="w-56 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => updateSettings({ frontendUrl: localFrontendUrl })}
                  disabled={localFrontendUrl === settings.frontendUrl}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {t("admin.save")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("admin.emailConfig")}
            </h2>
            <label className="flex items-center gap-2">
              <span className="font-urbanist text-xs font-medium text-gray-500 dark:text-gray-400">
                {localEmailEnabled ? t("admin.enabled") : t("admin.disabled")}
              </span>
              <button
                onClick={() => {
                  const next = !localEmailEnabled;
                  setLocalEmailEnabled(next);
                  updateSettings({
                    smtpHost: localSmtpHost,
                    smtpPort: localSmtpPort,
                    smtpUser: localSmtpUser,
                    smtpPassword: localSmtpPassword || undefined,
                    fromEmail: localFromEmail,
                    emailSubject: localEmailSubject,
                    emailEnabled: next,
                  });
                }}
                className={`relative h-6 w-10 rounded-full transition-colors ${
                  localEmailEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-gray-200 ${
                    localEmailEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.smtpHost")}
                </label>
                <input
                  type="text"
                  value={localSmtpHost}
                  onChange={(e) => setLocalSmtpHost(e.target.value)}
                  placeholder={t("admin.smtpPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.smtpPort")}
                </label>
                <input
                  type="number"
                  value={localSmtpPort}
                  onChange={(e) => setLocalSmtpPort(Number(e.target.value))}
                  placeholder={t("admin.portPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.smtpUser")}
                </label>
                <input
                  type="text"
                  value={localSmtpUser}
                  onChange={(e) => setLocalSmtpUser(e.target.value)}
                  placeholder={t("admin.userPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.smtpPassword")}
                </label>
                <input
                  type="password"
                  value={localSmtpPassword}
                  onChange={(e) => setLocalSmtpPassword(e.target.value)}
                  placeholder={settings.smtpPassword ? t("admin.passwordKeepPlaceholder") : t("admin.passwordPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.fromEmail")}
                </label>
                <input
                  type="email"
                  value={localFromEmail}
                  onChange={(e) => setLocalFromEmail(e.target.value)}
                  placeholder={t("admin.fromPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("admin.emailSubject")}
                </label>
                <input
                  type="text"
                  value={localEmailSubject}
                  onChange={(e) => setLocalEmailSubject(e.target.value)}
                  placeholder={t("admin.subjectPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveEmailSettings}
                className="rounded-xl bg-primary px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
              >
                {t("admin.saveEmail")}
              </button>
              <button
                onClick={async () => {
                  const email = window.prompt(t("admin.sendTestEmailPrompt"), user?.email || "");
                  if (email) testEmail(email);
                }}
                disabled={!settings.smtpHost || !settings.emailEnabled}
                className="rounded-xl bg-gray-100 px-5 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("admin.sendTestEmail")}
              </button>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("admin.branding")}
          </h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("admin.corporateLogo")}
              </p>
              <p className="mb-3 font-urbanist text-xs text-gray-500 dark:text-gray-400">
                {t("admin.corporateLogoDesc")}
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Light Logo */}
                <div className="rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
                  <p className="mb-2 font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t("admin.lightVariant")}
                  </p>
                  {settings.logoUrl ? (
                    <div className="mb-3 flex items-center gap-4 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200 dark:bg-gray-800/50 dark:ring-gray-700">
                      <img
                        src={settings.logoUrl}
                        alt={t("admin.currentLogo")}
                        className="h-10 w-auto rounded-lg object-contain"
                      />
                      <span className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                        {t("admin.currentLogo")}
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center justify-center rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200 dark:bg-gray-800/50 dark:ring-gray-700">
                      <span className="font-urbanist text-sm text-gray-400 dark:text-gray-500">
                        {t("admin.noLogo")}
                      </span>
                    </div>
                  )}
                  <input
                    ref={logoLightInputRef}
                    type="file"
                    accept=".png,.svg"
                    className="hidden"
                    onChange={handleLogoSelectLight}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => logoLightInputRef.current?.click()}
                      disabled={logoUploadingLight}
                      className="rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                    >
                      {logoUploadingLight ? t("admin.uploading") : t("admin.uploadLogo")}
                    </button>
                    {settings.logoUrl && (
                      <button
                        onClick={handleLogoRemoveLight}
                        disabled={logoUploadingLight}
                        className="rounded-lg bg-red-100 px-3 py-1.5 font-urbanist text-xs font-medium text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      >
                        {t("admin.remove")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dark Logo */}
                <div className="rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                  <p className="mb-2 font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t("admin.darkVariant")}
                  </p>
                  {settings.logoUrlDark ? (
                    <div className="mb-3 flex items-center gap-4 rounded-lg bg-gray-800 p-3 ring-1 ring-gray-700">
                      <img
                        src={settings.logoUrlDark}
                        alt={t("admin.currentLogoDark")}
                        className="h-10 w-auto rounded-lg object-contain"
                      />
                      <span className="font-urbanist text-xs text-gray-400">
                        {t("admin.currentLogo")}
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center justify-center rounded-lg bg-gray-800 p-4 ring-1 ring-gray-700">
                      <span className="font-urbanist text-sm text-gray-500">
                        {t("admin.noLogo")}
                      </span>
                    </div>
                  )}
                  <input
                    ref={logoDarkInputRef}
                    type="file"
                    accept=".png,.svg"
                    className="hidden"
                    onChange={handleLogoSelectDark}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => logoDarkInputRef.current?.click()}
                      disabled={logoUploadingDark}
                      className="rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                    >
                      {logoUploadingDark ? t("admin.uploading") : t("admin.uploadLogo")}
                    </button>
                    {settings.logoUrlDark && (
                      <button
                        onClick={handleLogoRemoveDark}
                        disabled={logoUploadingDark}
                        className="rounded-lg bg-red-100 px-3 py-1.5 font-urbanist text-xs font-medium text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                      >
                        {t("admin.remove")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("admin.backupRestore")}
          </h2>

          {/* Settings */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t("admin.schedule")}
              </label>
              <select
                value={backupSettings.backupInterval}
                onChange={(e) => updateBackupSettings({ backupInterval: e.target.value })}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="manual">{t("admin.scheduleManual")}</option>
                <option value="daily">{t("admin.scheduleDaily")}</option>
                <option value="weekly">{t("admin.scheduleWeekly")}</option>
                <option value="monthly">{t("admin.scheduleMonthly")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t("admin.retention")}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={backupSettings.backupRetention}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(100, Number(e.target.value)));
                  updateBackupSettings({ backupRetention: v });
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2">
                <span className="font-urbanist text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("admin.encrypt")}
                </span>
                <button
                  onClick={() => updateBackupSettings({ backupEncrypted: !backupSettings.backupEncrypted })}
                  className={`relative h-6 w-10 rounded-full transition-colors ${
                    backupSettings.backupEncrypted ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-gray-200 ${
                      backupSettings.backupEncrypted ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Create button */}
          <div className="mb-6">
            <button
              onClick={() => createBackup(backupSettings.backupEncrypted)}
              disabled={backupCreating}
              className="rounded-xl bg-primary px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            >
              {backupCreating ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("admin.creating")}
                </span>
              ) : (
                t("admin.generateBackup")
              )}
            </button>
          </div>

          {/* Backup list */}
          {backups.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-6 text-center ring-1 ring-gray-200 dark:bg-gray-800/50 dark:ring-gray-700">
              <p className="font-urbanist text-sm text-gray-400 dark:text-gray-500">
                {t("admin.noBackups")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.name}
                  className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 8l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                      {backup.name}
                      {backup.encrypted && (
                        <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {t("admin.encrypted")}
                        </span>
                      )}
                    </p>
                    <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                      {formatBytes(backup.size)} &middot; {new Date(backup.date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/admin/backups/${encodeURIComponent(backup.name)}/download`, {
                            headers: { authorization: `Bearer ${getAccessToken()}` },
                          });
                          if (!res.ok) { toast.error("Download failed"); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = backup.name;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Download failed");
                        }
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
                      title={t("admin.download")}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => restoreBackup(backup.name)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30"
                      title={t("admin.restore")}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteBackup(backup.name)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                      title={t("admin.delete")}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("admin.users")}
          </h2>
          <UsersTable />
        </div>

        {/* Factory Reset */}
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
          <h2 className="mb-2 font-outfit text-lg font-semibold text-red-700 dark:text-red-400">
            {t("admin.factoryReset")}
          </h2>
          <p className="mb-4 font-urbanist text-sm text-red-600 dark:text-red-300">
            {t("admin.factoryResetDesc")}
          </p>
          <button
            onClick={handleOpenWipeModal}
            className="rounded-xl bg-red-600 px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t("admin.wipeAllData")}
          </button>
        </div>
      </div>

      {/* Wipe confirmation modal */}
      {wipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="mb-3 font-outfit text-lg font-semibold text-red-600 dark:text-red-400">
              {t("admin.wipeModalTitle")}
            </h3>
            <div className="mb-4 space-y-2 font-urbanist text-sm text-gray-600 dark:text-gray-300">
              <p>{t("admin.wipeModalWarningBefore")}<strong>{t("admin.wipeModalWarningStrong")}</strong>{t("admin.wipeModalWarningAfter")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("admin.wipeModalItemUsers")}</li>
                <li>{t("admin.wipeModalItemData")}</li>
                <li>{t("admin.wipeModalItemPomodoro")}</li>
                <li>{t("admin.wipeModalItemFiles")}</li>
                <li>{t("admin.wipeModalItemSettings")}</li>
                <li>{t("admin.wipeModalItemLogs")}</li>
              </ul>
              <p className="mt-3">{t("admin.wipeModalRedirect")}</p>
              <p className="mt-2 text-xs text-gray-400">{t("admin.wipeModalPreserved")}</p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("admin.wipeModalPassword")}
              </label>
              <input
                type="password"
                value={wipePassword}
                onChange={(e) => setWipePassword(e.target.value)}
                placeholder={t("admin.wipeModalPasswordPlaceholder")}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                disabled={wipeRunning}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCloseWipeModal}
                disabled={wipeRunning}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("admin.wipeCancel")}
              </button>
              <button
                onClick={handleConfirmWipe}
                disabled={!wipeConfirmEnabled || !wipePassword || wipeRunning}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {wipeRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t("admin.wiping")}
                  </span>
                ) : wipeConfirmEnabled ? (
                  t("admin.wipeConfirm")
                ) : (
                  t("admin.waitToConfirm", { count: wipeCountdown })
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
    </AppLayout>
  );
}
