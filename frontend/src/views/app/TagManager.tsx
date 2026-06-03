import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTagStore, type Tag } from "../../store/tagStore";
import TagPill from "../../components/tags/TagPill";
import AppLayout from "../../components/AppLayout";

const TAG_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
];

export default function TagManager() {
  const { tags, fetchTags, updateTag, deleteTag } = useTagStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [colorDropdownId, setColorDropdownId] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    function handleClick() { setColorDropdownId(null); }
    if (colorDropdownId) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [colorDropdownId]);

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
      <AppLayout title="Tags">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mx-auto mt-20 max-w-2xl px-4">
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
              <p className="font-urbanist text-sm text-gray-400">
                No tags yet. Create one from the task detail panel.
              </p>
            </div>
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Tags">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manage Tags
          </h2>
          <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="rounded-xl bg-gray-100 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Back
          </Link>
          </div>
        </div>

        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800"
            >
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorDropdownId(colorDropdownId === tag.id ? null : tag.id);
                  }}
                  className="inline-block h-5 w-5 rounded-full ring-2 ring-transparent transition-all hover:ring-gray-300 focus:outline-none"
                  style={{ backgroundColor: tag.color }}
                />
                {colorDropdownId === tag.id && (
                  <div
                    className="absolute left-0 top-7 z-20 w-36 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          handleColorChange(tag, c);
                          setColorDropdownId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left font-urbanist text-xs text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                        {c}
                      </button>
                    ))}
                  </div>
                )}
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
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  autoFocus
                />
              ) : (
                <span className="flex-1 font-urbanist text-sm text-gray-900 dark:text-gray-100">
                  {tag.name}
                </span>
              )}

              <span className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
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
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(tag)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 font-urbanist text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
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
      </motion.div>
    </AppLayout>
  );
}
