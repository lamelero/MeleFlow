import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import { useAdminStore } from "../../store/adminStore";
import { useBrandingStore } from "../../store/brandingStore";
import StatsCards from "../../components/admin/StatsCards";
import UsersTable from "../../components/admin/UsersTable";
import AppLayout from "../../components/AppLayout";

export default function AdminPanel() {
  const { user } = useAuthStore();
  const { stats, settings, fetchUsers, fetchStats, fetchSettings, updateSettings, testEmail, error, clearError } = useAdminStore();
  const [localUploadSize, setLocalUploadSize] = useState(settings.maxUploadSize);
  const [localStorageQuota, setLocalStorageQuota] = useState(Math.round(settings.maxStoragePerUser / (1024 * 1024 * 1024)));
  const [localMaxAttempts, setLocalMaxAttempts] = useState(settings.maxLoginAttempts);
  const [localLockoutMinutes, setLocalLockoutMinutes] = useState(settings.loginLockoutMinutes);

  // Email settings local state
  const [localSmtpHost, setLocalSmtpHost] = useState(settings.smtpHost);
  const [localSmtpPort, setLocalSmtpPort] = useState(settings.smtpPort);
  const [localSmtpUser, setLocalSmtpUser] = useState(settings.smtpUser);
  const [localSmtpPassword, setLocalSmtpPassword] = useState("");
  const [localFromEmail, setLocalFromEmail] = useState(settings.fromEmail);
  const [localEmailSubject, setLocalEmailSubject] = useState(settings.emailSubject);
  const [localEmailEnabled, setLocalEmailEnabled] = useState(settings.emailEnabled);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const { fetchLogo } = useBrandingStore();

  const handleLogoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      await useAdminStore.getState().uploadLogo(file);
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploading(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }, [fetchLogo]);

  const handleLogoRemove = useCallback(async () => {
    setLogoUploading(true);
    try {
      await useAdminStore.getState().removeLogo();
      await fetchLogo();
    } catch {
      // error handled in store
    }
    setLogoUploading(false);
  }, [fetchLogo]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchSettings();
  }, [fetchStats, fetchUsers, fetchSettings]);

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
            Access denied. Admin only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Admin Panel">
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
          Back to App
        </Link>

        {error && (
          <div className="flex items-center justify-between rounded-2xl bg-red-50 px-5 py-3 ring-1 ring-red-200 dark:bg-red-900/20 dark:ring-red-800/30">
            <span className="font-urbanist text-sm text-red-700 dark:text-red-400">{error}</span>
            <button
              onClick={clearError}
              className="text-sm text-red-500 hover:text-red-700 dark:text-red-400"
            >
              Dismiss
            </button>
          </div>
        )}

        <StatsCards stats={stats} />

        {/* General Settings */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  Allow registration
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  Allow new users to sign up
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
                  Max upload size
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  Maximum file size in MB (1–200)
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
                      toast.error("Must be between 1 and 200");
                    }
                  }}
                  disabled={localUploadSize === settings.maxUploadSize}
                  className="rounded-xl bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  Storage quota per user
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  Max storage per user in GB (1–1024)
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
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  Max login attempts
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  Failed attempts before lockout (1–100)
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
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                  Lockout duration
                </p>
                <p className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                  Minutes locked after failed attempts (1–1440)
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
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
              Email Configuration
            </h2>
            <label className="flex items-center gap-2">
              <span className="font-urbanist text-xs font-medium text-gray-500 dark:text-gray-400">
                {localEmailEnabled ? "Enabled" : "Disabled"}
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
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={localSmtpHost}
                  onChange={(e) => setLocalSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={localSmtpPort}
                  onChange={(e) => setLocalSmtpPort(Number(e.target.value))}
                  placeholder="587"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={localSmtpUser}
                  onChange={(e) => setLocalSmtpUser(e.target.value)}
                  placeholder="user@example.com"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={localSmtpPassword}
                  onChange={(e) => setLocalSmtpPassword(e.target.value)}
                  placeholder={settings.smtpPassword ? "•••••••• (leave blank to keep)" : "Enter password"}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  From Email
                </label>
                <input
                  type="email"
                  value={localFromEmail}
                  onChange={(e) => setLocalFromEmail(e.target.value)}
                  placeholder="noreply@example.com"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={localEmailSubject}
                  onChange={(e) => setLocalEmailSubject(e.target.value)}
                  placeholder="Reminder: {{title}} is due soon"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveEmailSettings}
                className="rounded-xl bg-primary px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
              >
                Save Email Settings
              </button>
              <button
                onClick={async () => {
                  const email = window.prompt("Send test email to:", user?.email || "");
                  if (email) testEmail(email);
                }}
                disabled={!settings.smtpHost || !settings.emailEnabled}
                className="rounded-xl bg-gray-100 px-5 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Send Test Email
              </button>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            Branding
          </h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                Corporate Logo
              </p>
              <p className="mb-3 font-urbanist text-xs text-gray-500 dark:text-gray-400">
                Upload a PNG or SVG logo (max 2MB). It will replace the site name in the app header and login page.
              </p>
              {settings.logoUrl ? (
                <div className="mb-3 flex items-center gap-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200 dark:bg-gray-800/50 dark:ring-gray-700">
                  <img
                    src={settings.logoUrl}
                    alt="Logo preview"
                    className="h-12 w-auto rounded-lg object-contain"
                  />
                  <span className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
                    Current logo
                  </span>
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-center rounded-xl bg-gray-50 p-6 ring-1 ring-gray-200 dark:bg-gray-800/50 dark:ring-gray-700">
                  <span className="font-urbanist text-sm text-gray-400 dark:text-gray-500">
                    No logo uploaded
                  </span>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept=".png,.svg"
                className="hidden"
                onChange={handleLogoSelect}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {logoUploading ? "Uploading..." : "Upload Logo"}
                </button>
                {settings.logoUrl && (
                  <button
                    onClick={handleLogoRemove}
                    disabled={logoUploading}
                    className="rounded-xl bg-red-100 px-4 py-2 font-urbanist text-sm font-medium text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            Users
          </h2>
          <UsersTable />
        </div>
      </div>
    </motion.div>
    </AppLayout>
  );
}
