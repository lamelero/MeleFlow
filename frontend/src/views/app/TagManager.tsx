import { useEffect, useState } from "react";
import { useTagStore, type Tag } from "../../store/tagStore";
import TagPill from "../../components/tags/TagPill";
import { useAuthStore } from "../../store/authStore";

const TAG_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

export default function TagManager() {
  const { tags, fetchTags, updateTag, deleteTag } = useTagStore();
  const { user, logout } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(tag: Tag) {
    await updateTag(tag.id, { name: editName });
    setEditingId(null);
  }

  async function handleColorChange(tag: Tag, color: string) {
    await updateTag(tag.id, { color });
  }

  async function handleDelete(tag: Tag) {
    if (window.confirm(`Delete tag "${tag.name}"? It will be removed from all tasks.`)) {
      await deleteTag(tag.id);
    }
  }

  if (tags.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAFAFA]">
        <Header user={user} logout={logout} />
        <div className="mx-auto mt-20 max-w-2xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p className="font-urbanist text-sm text-gray-400">
              No tags yet. Create one from the task detail panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Header user={user} logout={logout} />

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-outfit text-lg font-semibold text-gray-900">
            Manage Tags
          </h2>
          <a
            href="/app"
            className="rounded-xl bg-gray-100 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Back
          </a>
        </div>

        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
            >
              <div className="relative">
                <span
                  className="inline-block h-5 w-5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <select
                  value={tag.color}
                  onChange={(e) => handleColorChange(tag, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  {TAG_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {editingId === tag.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(tag);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 font-urbanist text-sm outline-none focus:border-primary"
                  autoFocus
                />
              ) : (
                <span className="flex-1 font-urbanist text-sm text-gray-900">
                  {tag.name}
                </span>
              )}

              <span className="font-urbanist text-xs text-gray-400">
                {tag._count?.tasks ?? 0} tasks
              </span>

              <div className="flex gap-1">
                {editingId === tag.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(tag)}
                      className="rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(tag)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 font-urbanist text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({
  user,
  logout,
}: {
  user: { username?: string } | null;
  logout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <h1 className="font-outfit text-xl font-bold text-primary">MeleNotes</h1>
        <div className="flex items-center gap-3">
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
  );
}
