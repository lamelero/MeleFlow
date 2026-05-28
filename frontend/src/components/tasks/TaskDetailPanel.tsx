import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import type { Task } from "../../store/taskStore";
import { useTaskStore } from "../../store/taskStore";
import { useTagStore, type Tag } from "../../store/tagStore";
import { client } from "../../api/client";
import TagPill from "../tags/TagPill";

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { updateTask, replaceTask } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Derive task from store for reactive updates after tag changes
  const storeTask = useTaskStore((s) =>
    task ? s.tasks.find((t) => t.id === task.id) : undefined,
  );
  const t: Task = (storeTask ?? task)!;

  useEffect(() => {
    if (t) {
      setDescription(t.description || "");
      setPreview(false);
    }
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (t) fetchTags();
  }, [t, fetchTags]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!t) return null;

  async function handleSaveDescription() {
    setSaving(true);
    await updateTask(t.id, { description: description || null });
    setSaving(false);
  }

  async function handleAddTag(tag: Tag) {
    const { data } = await client.post(`/tasks/${t.id}/tags`, { tagId: tag.id });
    replaceTask(data);
  }

  async function handleRemoveTag(tagId: string) {
    const { data } = await client.delete(`/tasks/${t.id}/tags/${tagId}`);
    replaceTask(data);
  }

  const usedTagIds = new Set(t.tags?.map((tg: Tag) => tg.id) ?? []);
  const availableTags = tags.filter((tg) => !usedTagIds.has(tg.id));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                t.isCompleted ? "bg-green-500" : "bg-primary"
              }`}
            />
            <h2 className="font-outfit text-lg font-semibold text-gray-900">
              {t.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {t.tags && t.tags.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {t.tags.map((tag: Tag) => (
                  <TagPill
                    key={tag.id}
                    tag={tag}
                    onRemove={() => handleRemoveTag(tag.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400">
              Add tag
            </label>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 font-urbanist text-xs text-gray-500 transition-colors hover:border-primary hover:text-primary"
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="font-urbanist text-xs text-gray-400">
                No more tags available
              </p>
            )}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400">
                Description
              </label>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="rounded-lg px-2 py-1 font-urbanist text-xs text-gray-500 hover:bg-gray-100"
              >
                {preview ? "Edit" : "Preview"}
              </button>
            </div>

            {preview ? (
              <div className="min-h-[120px] rounded-xl border border-gray-200 bg-gray-50 p-4 font-urbanist text-sm text-gray-700 prose prose-sm max-w-none">
                {description ? (
                  <Markdown>{description}</Markdown>
                ) : (
                  <span className="text-gray-400">No description</span>
                )}
              </div>
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (Markdown supported)..."
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>

          {t.dueDate && (
            <div className="flex items-center gap-3 text-sm">
              <div>
                <span className="font-urbanist text-xs text-gray-400">Due</span>
                <p className="font-urbanist text-sm text-gray-700">
                  {new Date(t.dueDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {!preview && (
          <div className="border-t border-gray-100 px-6 py-4">
            <button
              onClick={handleSaveDescription}
              disabled={saving}
              className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
