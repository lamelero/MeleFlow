import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAdminStore } from "../../store/adminStore";

interface EditForm {
  email: string;
  username: string;
  displayName: string;
}

export default function UsersTable() {
  const { users, updateUser, deleteUser, isLoading } = useAdminStore();
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ email: "", username: "", displayName: "" });
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  function openEdit(user: (typeof users)[0]) {
    setEditForm({ email: user.email, username: user.username, displayName: user.displayName || "" });
    setEditingUser(user.id);
  }

  async function handleSaveEdit(userId: string) {
    if (!editForm.email.trim() || !editForm.username.trim()) {
      toast.error("Email and username are required");
      return;
    }
    setUpdating(userId);
    try {
      await updateUser(userId, {
        email: editForm.email.trim(),
        username: editForm.username.trim(),
        displayName: editForm.displayName.trim() || undefined,
      });
      setEditingUser(null);
      toast.success("User updated");
    } catch {
      // error handled in store
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(userId: string) {
    setUpdating(userId);
    try {
      await deleteUser(userId);
      setDeletingUser(null);
    } catch {
      // error handled in store
    } finally {
      setUpdating(null);
    }
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <p className="font-urbanist text-sm text-gray-400 dark:text-gray-500">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <p className="font-urbanist text-sm text-gray-400 dark:text-gray-500">No users found</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Username
                </th>
                <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active
                </th>
                <th className="px-4 py-3 text-left font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tasks
                </th>
                <th className="px-4 py-3 text-right font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.username}
                  </td>
                  <td className="px-4 py-3 font-urbanist text-sm text-gray-600 dark:text-gray-400">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-urbanist text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
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
                  <td className="px-4 py-3 font-urbanist text-sm text-gray-600 dark:text-gray-400">
                    {user._count.tasks}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRoleToggle(user.id, user.role)}
                        disabled={updating === user.id}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Toggle role
                      </button>
                      <button
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                        disabled={updating === user.id}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 font-urbanist text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingUser(user.id)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 font-urbanist text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                Edit User
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="(empty = same as username)"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl bg-gray-100 px-5 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(editingUser)}
                  disabled={updating === editingUser}
                  className="rounded-xl bg-primary px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {updating === editingUser ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setDeletingUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="mb-2 font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete user?
              </h2>
              <p className="font-urbanist text-sm text-gray-600 dark:text-gray-400">
                This will permanently remove{" "}
                <strong>{users.find((u) => u.id === deletingUser)?.username}</strong>{" "}
                and all their tasks, lists, habits, tags, and data. This action cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="rounded-xl bg-gray-100 px-5 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingUser)}
                  disabled={updating === deletingUser}
                  className="rounded-xl bg-red-600 px-5 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {updating === deletingUser ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

async function handleRoleToggle(userId: string, currentRole: string) {
  try {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    await useAdminStore.getState().updateUser(userId, { role: newRole });
    toast.success(`User role updated to ${newRole}`);
  } catch {
    toast.error("Failed to update role");
  }
}

async function handleToggleActive(userId: string, currentActive: boolean) {
  try {
    await useAdminStore.getState().updateUser(userId, { isActive: !currentActive });
    toast.success(`User ${currentActive ? "deactivated" : "activated"}`);
  } catch {
    toast.error("Failed to update user");
  }
}
