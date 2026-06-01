import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import { useAdminStore } from "../../store/adminStore";
import StatsCards from "../../components/admin/StatsCards";
import UsersTable from "../../components/admin/UsersTable";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";

export default function AdminPanel() {
  const { user, logout } = useAuthStore();
  const { stats, settings, fetchUsers, fetchStats, fetchSettings, updateSettings, error, clearError } = useAdminStore();
  const [localUploadSize, setLocalUploadSize] = useState(settings.maxUploadSize);
  const [localMaxAttempts, setLocalMaxAttempts] = useState(settings.maxLoginAttempts);
  const [localLockoutMinutes, setLocalLockoutMinutes] = useState(settings.loginLockoutMinutes);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchSettings();
  }, [fetchStats, fetchUsers, fetchSettings]);

  useEffect(() => {
    setLocalUploadSize(settings.maxUploadSize);
    setLocalMaxAttempts(settings.maxLoginAttempts);
    setLocalLockoutMinutes(settings.loginLockoutMinutes);
  }, [settings.maxUploadSize, settings.maxLoginAttempts, settings.loginLockoutMinutes]);

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen"
    >
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <h1 className="font-outfit text-xl font-bold text-primary">
            Admin Panel
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="/app"
              className="rounded-xl bg-gray-100 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back to App
            </a>
            <ThemeToggle />
            <LanguageSwitcher />
            <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="rounded-xl bg-red-500 px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-4">
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

        <div>
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            Users
          </h2>
          <UsersTable />
        </div>
      </div>
    </motion.div>
  );
}
