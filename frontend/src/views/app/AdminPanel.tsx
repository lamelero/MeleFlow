import { useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAdminStore } from "../../store/adminStore";
import StatsCards from "../../components/admin/StatsCards";
import UsersTable from "../../components/admin/UsersTable";
import LanguageSwitcher from "../../components/LanguageSwitcher";

export default function AdminPanel() {
  const { user, logout } = useAuthStore();
  const { stats, fetchUsers, fetchStats, error, clearError } = useAdminStore();

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, [fetchStats, fetchUsers]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <p className="font-urbanist text-sm text-red-500">
            Access denied. Admin only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <h1 className="font-outfit text-xl font-bold text-primary">
            Admin Panel
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="/app"
              className="rounded-xl bg-gray-100 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Back to App
            </a>
            <LanguageSwitcher />
            <span className="font-urbanist text-sm text-gray-600">
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
          <div className="flex items-center justify-between rounded-2xl bg-red-50 px-5 py-3 ring-1 ring-red-200">
            <span className="font-urbanist text-sm text-red-700">{error}</span>
            <button
              onClick={clearError}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        <StatsCards stats={stats} />

        <div>
          <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900">
            Users
          </h2>
          <UsersTable />
        </div>
      </div>
    </div>
  );
}
