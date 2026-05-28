import { useState } from "react";
import toast from "react-hot-toast";
import { useAdminStore } from "../../store/adminStore";

export default function UsersTable() {
  const { users, updateUser, isLoading } = useAdminStore();
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleRoleToggle(userId: string, currentRole: string) {
    setUpdating(userId);
    try {
      const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
      await updateUser(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    setUpdating(userId);
    try {
      await updateUser(userId, { isActive: !currentActive });
      toast.success(`User ${currentActive ? "deactivated" : "activated"}`);
    } catch {
      toast.error("Failed to update user");
    } finally {
      setUpdating(null);
    }
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
        <p className="font-urbanist text-sm text-gray-400">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
        <p className="font-urbanist text-sm text-gray-400">No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Username
              </th>
              <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Active
              </th>
              <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Tasks
              </th>
              <th className="px-4 py-3 text-right font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-urbanist text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-4 py-3 font-urbanist text-sm text-gray-600">
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 font-urbanist text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      user.isActive ? "bg-green-500" : "bg-red-400"
                    }`}
                  />
                </td>
                <td className="px-4 py-3 font-urbanist text-sm text-gray-600">
                  {user._count.tasks}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleRoleToggle(user.id, user.role)}
                      disabled={updating === user.id}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                    >
                      Toggle role
                    </button>
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={updating === user.id}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
