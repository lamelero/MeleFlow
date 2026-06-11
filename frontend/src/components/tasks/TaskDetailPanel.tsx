import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import Markdown from "react-markdown";
import toast from "react-hot-toast";
import type { Task, Attachment } from "../../store/taskStore";
import { getNextTrigger, formatNextTrigger } from "../../lib/nextTriggerTime";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
import { useTaskStore } from "../../store/taskStore";
import { useAuthStore } from "../../store/authStore";
import { useTagStore, type Tag, randomTagColor } from "../../store/tagStore";
import { client } from "../../api/client";
import TagPill from "../tags/TagPill";
import { registerBackHandler } from "../../capacitor/register";
import "react-datepicker/dist/react-datepicker.css";

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { t: trans } = useTranslation();
  const { updateTask, replaceTask, addCollaborator, removeCollaborator } = useTaskStore();
  const currentUser = useAuthStore((s) => s.user);
  const { tags, fetchTags, createTag } = useTagStore();
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [uploading, setUploading] = useState(false);
  const [taskType, setTaskType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [checklistItems, setChecklistItems] = useState<{ id?: string; text: string; isCompleted: boolean; position: number }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [reminders, setReminders] = useState<{ id: string; time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number }[]>([]);
  const [editingReminder, setEditingReminder] = useState<{ id: string; time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number } | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }[]>([]);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [shareSearching, setShareSearching] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }[]>([]);
  const [priority, setPriority] = useState(4);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checklistInputRef = useRef<HTMLInputElement>(null);
  const shareSearchRef = useRef<HTMLInputElement>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const storeTask = useTaskStore((s) =>
    task ? s.tasks.find((t) => t.id === task.id) : undefined,
  );
  const t: Task = (storeTask ?? task)!;

  useEffect(() => {
    if (t) {
      setDescription(t.description || "");
      setDueDate(t.dueDate ? new Date(t.dueDate) : null);
      setPriority(t.priority ?? 4);
      setTaskType(t.type || "TEXT");
      setChecklistItems(t.checklistItems ?? []);
      if (t.reminderEnabled && t.reminderConfig) {
        try {
          const parsed = JSON.parse(t.reminderConfig);
          if (Array.isArray(parsed)) {
            setReminders(parsed);
          } else if (parsed?.type && parsed?.reminderTime) {
            const legacy: { id: string; time: string; frequency: "always" | "weekly" | "before_due"; days?: number[] }[] = [];
            if (parsed.type === "daily") {
              legacy.push({ id: "1", time: parsed.reminderTime, frequency: "always" });
            } else if (parsed.type === "weekly" && parsed.days?.length > 0) {
              legacy.push({ id: "1", time: parsed.reminderTime, frequency: "weekly", days: parsed.days });
            }
            setReminders(legacy);
          }
        } catch { /* silent */ }
      } else {
        setReminders([]);
      }
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

  useEffect(() => {
    const unregister = registerBackHandler(() => { onClose(); return true; });
    return unregister;
  }, [onClose]);

  useEffect(() => {
    if (!t?.id) return;
    (async () => {
      try {
        const { data } = await client.get(`/tasks/${t.id}/collaborators`);
        setCollaborators(data);
      } catch { /* silent */ }
    })();
  }, [t?.id]);

  useEffect(() => {
    if (!shareSearchQuery.trim() || shareSearchQuery.length < 2) {
      setShareSearchResults([]);
      setShowShareDropdown(false);
      return;
    }
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(async () => {
      setShareSearching(true);
      try {
        const { data } = await client.get(`/auth/users/search?q=${encodeURIComponent(shareSearchQuery)}`);
        const existingIds = new Set([t?.userId, ...collaborators.map((c) => c.id)]);
        setShareSearchResults(data.filter((u: { id: string }) => !existingIds.has(u.id)));
        setShowShareDropdown(true);
      } catch { /* silent */ }
      setShareSearching(false);
    }, 300);
    return () => { if (shareTimerRef.current) clearTimeout(shareTimerRef.current); };
  }, [shareSearchQuery, collaborators, t?.userId]);

  if (!t) return null;

  async function handleSaveDescription() {
    setSaving(true);
    await updateTask(t.id, { description: description || null });
    setSaving(false);
  }

  async function handleAddTag(tag: Tag) {
    try {
      const { data } = await client.post(`/tasks/${t.id}/tags`, { tagId: tag.id });
      replaceTask(data);
      setTagInput("");
      setTagDropdownOpen(false);
      tagInputRef.current?.focus();
    } catch {
      toast.error(trans("common.toasts.failedAddTag"));
    }
  }

  async function handleRemoveTag(tagId: string) {
    try {
      const { data } = await client.delete(`/tasks/${t.id}/tags/${tagId}`);
      replaceTask(data);
    } catch {
      toast.error(trans("common.toasts.failedRemoveTag"));
    }
  }

  async function handleCreateAndAddTag(name: string) {
    try {
      const tag = await createTag({ name, color: randomTagColor() });
      await handleAddTag(tag);
    } catch {
      toast.error(trans("common.toasts.failedCreateTag"));
    }
  }

  async function handleAddReminder(r: { time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number }) {
    const newReminders = [...reminders, { ...r, id: String(Date.now()) }];
    setReminders(newReminders);
    setEditingReminder(null);
    await updateTask(t.id, { reminderEnabled: newReminders.length > 0, reminderConfig: JSON.stringify(newReminders) });
    const next = getNextTrigger(JSON.stringify(newReminders), t.dueDate);
    toast.success(`${trans("common.toasts.reminderSaved")} — next: ${formatNextTrigger(next)}`);
  }

  async function handleDeleteReminder(id: string) {
    const newReminders = reminders.filter((r) => r.id !== id);
    setReminders(newReminders);
    await updateTask(t.id, { reminderEnabled: newReminders.length > 0, reminderConfig: newReminders.length > 0 ? JSON.stringify(newReminders) : null });
    toast.success(trans("common.toasts.reminderDeleted"));
  }

  async function handleUpdateReminder(id: string, r: { time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number }) {
    const newReminders = reminders.map((rem) => rem.id === id ? { ...rem, ...r } : rem);
    setReminders(newReminders);
    setEditingReminder(null);
    await updateTask(t.id, { reminderEnabled: true, reminderConfig: JSON.stringify(newReminders) });
    const next = getNextTrigger(JSON.stringify(newReminders), t.dueDate);
    toast.success(`${trans("common.toasts.reminderSaved")} — next: ${formatNextTrigger(next)}`);
  }

  async function handleDateChange(date: Date | null) {
    setDueDate(date);
    await updateTask(t.id, { dueDate: date ? date.toISOString() : null });
    toast.success(date ? trans("common.toasts.dueDateSet") : trans("common.toasts.dueDateRemoved"));
  }

  async function handlePriorityChange(p: number) {
    setPriority(p);
    await updateTask(t.id, { priority: p });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await client.post(`/tasks/${t.id}/attachments`, form);
      replaceTask({
        ...t,
        attachments: [...(t.attachments ?? []), data],
      });
      toast.success(trans("common.toasts.fileUploaded"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data: { error?: string } } }).response?.data
              ?.error
          : null;
      toast.error(msg || trans("common.toasts.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    try {
      await client.delete(`/tasks/${t.id}/attachments/${attachment.id}`);
      replaceTask({
        ...t,
        attachments: (t.attachments ?? []).filter((a) => a.id !== attachment.id),
      });
      toast.success(trans("common.toasts.attachmentDeleted"));
    } catch {
      toast.error(trans("common.toasts.attachmentDeleteFailed"));
    }
  }

  async function handleTypeChange(type: "TEXT" | "CHECKLIST") {
    setTaskType(type);
    await updateTask(t.id, { type });
  }

  async function handleAddChecklistItem() {
    const text = newChecklistText.trim();
    if (!text) return;
    const items = [...checklistItems, { text, isCompleted: false, position: checklistItems.length }];
    setChecklistItems(items);
    setNewChecklistText("");
    await updateTask(t.id, { checklistItems: items, type: "CHECKLIST" });
    setTaskType("CHECKLIST");
    checklistInputRef.current?.focus();
  }

  async function handleChecklistItemKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleAddChecklistItem();
    }
  }

  async function handleToggleChecklistItem(index: number) {
    const items = checklistItems.map((item, i) =>
      i === index ? { ...item, isCompleted: !item.isCompleted } : item,
    );
    setChecklistItems(items);
    await updateTask(t.id, { checklistItems: items });
  }

  async function handleRemoveChecklistItem(index: number) {
    const items = checklistItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i }));
    setChecklistItems(items);
    await updateTask(t.id, { checklistItems: items });
  }

  function handleStartEdit(index: number, text: string) {
    setEditingIndex(index);
    setEditingText(text);
  }

  async function handleSaveEdit(index: number) {
    const text = editingText.trim();
    if (!text) return;
    const items = checklistItems.map((item, i) =>
      i === index ? { ...item, text } : item,
    );
    setChecklistItems(items);
    setEditingIndex(null);
    setEditingText("");
    await updateTask(t.id, { checklistItems: items });
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setEditingText("");
  }

  async function handleEditKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSaveEdit(index);
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  }

  async function handleTagKeyDown(e: React.KeyboardEvent) {
    const value = tagInput.trim();
    if (e.key === "Enter" && value) {
      e.preventDefault();
      const existing = tags.find(
        (tg) => tg.name.toLowerCase() === value.toLowerCase(),
      );
      if (existing) {
        await handleAddTag(existing);
      } else {
        await handleCreateAndAddTag(value);
      }
    }
    if (e.key === "Escape") {
      setTagDropdownOpen(false);
      setTagInput("");
    }
  }

  function handleTagInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTagInput(e.target.value);
    setTagDropdownOpen(true);
  }

  async function handleAddCollaborator(username: string) {
    try {
      await addCollaborator(t.id, username);
      const { data } = await client.get(`/tasks/${t.id}/collaborators`);
      setCollaborators(data);
      setShareSearchQuery("");
      setShowShareDropdown(false);
    } catch {
      toast.error(trans("common.toasts.failedAddCollaborator"));
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    try {
      await removeCollaborator(t.id, collaboratorId);
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    } catch {
      toast.error(trans("common.toasts.failedRemoveCollaborator"));
    }
  }

  const isOwner = currentUser?.id === t.userId;

  const usedTagIds = new Set(t.tags?.map((tg: Tag) => tg.id) ?? []);
  const availableTags = tags.filter((tg) => !usedTagIds.has(tg.id));
  const filteredAvailable = tagInput
    ? availableTags.filter((tg) =>
        tg.name.toLowerCase().includes(tagInput.toLowerCase()),
      )
    : availableTags;
  const exactMatch = tagInput
    ? tags.some((tg) => tg.name.toLowerCase() === tagInput.toLowerCase())
    : false;
  const showCreate = tagDropdownOpen && tagInput && !exactMatch;
  const showExisting = tagDropdownOpen && filteredAvailable.length > 0;

  const panelVariants = {
    hidden: { x: "100%" },
    visible: { x: 0, transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
    exit: { x: "100%", transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      {t && (
        <motion.div
          key={t.id}
          className="fixed inset-0 z-50 flex"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            variants={backdropVariants}
            className="flex-1 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            variants={panelVariants}
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-gray-900"
          >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pb-4 dark:border-gray-800" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                t.isCompleted ? "bg-green-500" : "bg-primary"
              }`}
            />
            <h2 className="font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {trans("common.priority")}
            </label>
            <div className="flex gap-1.5">
              {[
                { value: 1, color: "#EF4444", label: trans("common.urgent") },
                { value: 2, color: "#F59E0B", label: trans("common.high") },
                { value: 3, color: "#3B82F6", label: trans("common.medium") },
                { value: 4, color: "#9CA3AF", label: trans("common.low") },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePriorityChange(p.value)}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-center font-urbanist text-xs font-medium transition-all ${
                    priority === p.value
                      ? "text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                  style={priority === p.value ? { backgroundColor: p.color } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {t.tags && t.tags.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {trans("common.tags")}
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
              <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {trans("common.addTag")}
              </label>
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onFocus={() => setTagDropdownOpen(true)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={trans("common.searchOrCreateTag")}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              {showCreate && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <button
                    onClick={() => handleCreateAndAddTag(tagInput)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-sm text-primary transition-colors hover:bg-primary/5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {trans("common.create")} "{tagInput}"
                  </button>
                </div>
              )}
              {showExisting && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {filteredAvailable.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
              {tagDropdownOpen && !tagInput && availableTags.length === 0 && !showCreate && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <p className="font-urbanist text-xs text-gray-400">
                    {trans("common.allTagsAssigned")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
              <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {trans("common.type")}
              </label>
              <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => handleTypeChange("TEXT")}
                  className={`flex-1 rounded-lg px-3 py-2 font-urbanist text-sm font-medium transition-all ${
                    taskType === "TEXT"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {trans("common.text")}
                </button>
                <button
                  onClick={() => handleTypeChange("CHECKLIST")}
                  className={`flex-1 rounded-lg px-3 py-2 font-urbanist text-sm font-medium transition-all ${
                    taskType === "CHECKLIST"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {trans("common.checklist")}
              </button>
            </div>
          </div>

          {taskType === "CHECKLIST" ? (
            <div className="mb-4">
              <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {trans("common.items")}
              </label>
              <div className="mb-3 flex gap-2">
                <input
                  ref={checklistInputRef}
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={handleChecklistItemKeyDown}
                  placeholder={trans("common.addItem")}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                <button
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistText.trim()}
                  className="rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  {trans("common.add")}
                </button>
              </div>
              {checklistItems.length === 0 ? (
                <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                  {trans("common.noItems")}
                </p>
              ) : (
                <div className="space-y-1">
                  {checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="group flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                    >
                      <button
                        onClick={() => handleToggleChecklistItem(index)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          item.isCompleted
                            ? "border-primary bg-primary text-white"
                            : "border-gray-300 hover:border-primary dark:border-gray-600"
                        }`}
                      >
                        {item.isCompleted && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      {editingIndex === index ? (
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={() => handleSaveEdit(index)}
                          onKeyDown={(e) => handleEditKeyDown(e, index)}
                          autoFocus
                          className="flex-1 rounded-lg border border-primary bg-white px-3 py-1.5 font-urbanist text-sm outline-none ring-2 ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        />
                      ) : (
                        <span
                          onClick={() => handleStartEdit(index, item.text)}
                          className={`flex-1 cursor-text font-urbanist text-sm ${
                            item.isCompleted ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {item.text}
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="shrink-0 rounded-lg p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {trans("common.description")}
                </label>
                <button
                  type="button"
                  onClick={() => setPreview(!preview)}
                  className="rounded-lg px-2 py-1 font-urbanist text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {preview ? trans("common.edit") : trans("common.preview")}
                </button>
              </div>

              {preview ? (
                <div className="min-h-[120px] rounded-xl border border-gray-200 bg-gray-50 p-4 font-urbanist text-sm text-gray-700 prose prose-sm max-w-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {description ? (
                    <Markdown>{description}</Markdown>
                  ) : (
                    <span className="text-gray-400">{trans("common.noDescription")}</span>
                  )}
                </div>
              ) : (
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={trans("common.description") + "..."}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {trans("common.dueDate")}
            </label>
            <div className="relative">
              <DatePicker
                selected={dueDate}
                onChange={handleDateChange}
                dateFormat="MMM d, yyyy"
                placeholderText={trans("common.setDueDate")}
                isClearable
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              {dueDate && (
                <button
                  onClick={() => handleDateChange(null)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {trans("common.reminders")}
              </label>
              <button
                onClick={() => setEditingReminder({ id: "", time: "09:00", frequency: "always" })}
                className="rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                + {trans("common.addReminder")}
              </button>
            </div>
            {reminders.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {reminders.map((r) => {
                  const dayNames = trans("calendar.dayHeaders", { returnObjects: true }) as unknown as string[];
                  const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : null;
                  return (
                    <div key={r.id} className="group flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-200">{r.time}</span>
                          <span className="font-urbanist text-xs text-gray-400">
                            {r.frequency === "always" && trans("common.always")}
                            {r.frequency === "weekly" && r.days?.map((d) => dayNames[d]).join(", ")}
                            {r.frequency === "before_due" && trans("common.beforeDue", { days: r.beforeDays })}
                          </span>
                        </div>
                        <p className="mt-0.5 font-urbanist text-xs text-gray-400/70">
                          {r.frequency === "always" && (dueStr ? trans("common.alwaysHelpUntil", { date: dueStr }) : trans("common.alwaysHelp"))}
                          {r.frequency === "weekly" && (dueStr ? trans("common.weeklyHelpUntil", { date: dueStr }) : trans("common.weeklyHelp"))}
                          {r.frequency === "before_due" && trans("common.beforeDueHelp")}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditingReminder(r)}
                          className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(r.id)}
                          className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {editingReminder && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <ReminderForm
                  initial={editingReminder}
                  onSave={(data) => {
                    if (editingReminder.id) {
                      handleUpdateReminder(editingReminder.id, data);
                    } else {
                      handleAddReminder(data);
                    }
                  }}
                  onCancel={() => setEditingReminder(null)}
                  trans={trans}
                />
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {trans("common.attachments")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:font-urbanist file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:file:text-primary"
            />
            {uploading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {trans("common.uploading")}
              </div>
            )}
            {t.attachments && t.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {t.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800"
                  >
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <a
                      href={att.fileUrl}
                      download={att.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate font-urbanist text-sm text-gray-700 hover:text-primary dark:text-gray-300"
                    >
                      {att.fileName}
                    </a>
                    <span className="shrink-0 font-urbanist text-xs text-gray-400">
                      {formatBytes(att.fileSize)}
                    </span>
                    <button
                      onClick={() => handleDeleteAttachment(att)}
                      className="shrink-0 rounded-lg p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="mb-2 block font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {trans("common.share")}
            </label>
            {isOwner && (
              <div className="relative mb-3">
                <input
                  ref={shareSearchRef}
                  type="text"
                  value={shareSearchQuery}
                  onChange={(e) => setShareSearchQuery(e.target.value)}
                  onFocus={() => shareSearchQuery.length >= 2 && setShowShareDropdown(true)}
                  placeholder={trans("common.searchUser")}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                {shareSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
                {showShareDropdown && shareSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {shareSearchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddCollaborator(user.username)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-urbanist text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {(user.displayName || user.username)[0].toUpperCase()}
                        </span>
                        <span>{user.displayName || user.username}</span>
                        <span className="text-xs text-gray-400">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showShareDropdown && shareSearchQuery.length >= 2 && !shareSearching && shareSearchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <p className="font-urbanist text-xs text-gray-400">{trans("common.noUsersFound")}</p>
                  </div>
                )}
              </div>
            )}
            {collaborators.length > 0 && (
              <div className="space-y-2">
                {collaborators.map((user) => (
                  <div
                    key={user.id}
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </span>
                    <span className="flex-1 font-urbanist text-sm text-gray-700 dark:text-gray-300">
                      {user.displayName || user.username}
                    </span>
                    <span className="font-urbanist text-xs text-gray-400">@{user.username}</span>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveCollaborator(user.id)}
                        className="shrink-0 rounded-lg p-1 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isOwner && collaborators.length === 0 && (
              <p className="font-urbanist text-xs text-gray-400">{trans("common.noCollaborators")}</p>
            )}
          </div>
        </div>

        {!preview && (
          <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button
              onClick={handleSaveDescription}
              disabled={saving}
              className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? trans("common.saving") : trans("common.save")}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReminderForm({ initial, onSave, onCancel, trans }: {
  initial: { id: string; time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number };
  onSave: (data: { time: string; frequency: "always" | "weekly" | "before_due"; days?: number[]; beforeDays?: number }) => void;
  onCancel: () => void;
  trans: (key: string, options?: any) => string;
}) {
  const [time, setTime] = useState(initial.time);
  const [frequency, setFrequency] = useState<"always" | "weekly" | "before_due">(initial.frequency);
  const [days, setDays] = useState<number[]>(initial.days ?? []);
  const [beforeDays, setBeforeDays] = useState(initial.beforeDays ?? 1);

  function handleDayToggle(day: number) {
    setDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  }

  const dayHeaders = (() => {
    try { return trans("calendar.dayHeaders", { returnObjects: true }) as unknown as string[]; } catch { return ["M","T","W","T","F","S","S"]; }
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div className="flex gap-2">
        {(["always", "weekly", "before_due"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFrequency(f)}
            className={`flex-1 rounded-lg px-3 py-2 font-urbanist text-sm font-medium transition-all ${
              frequency === f
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {f === "always" && trans("common.always")}
            {f === "weekly" && trans("common.weekly")}
            {f === "before_due" && trans("common.beforeDueShort")}
          </button>
        ))}
      </div>
      <p className="font-urbanist text-xs text-gray-400/70">
        {frequency === "always" && trans("common.alwaysHelpForm")}
        {frequency === "weekly" && trans("common.weeklyHelpForm")}
        {frequency === "before_due" && trans("common.beforeDueHelpForm")}
      </p>
      {frequency === "weekly" && (
        <div className="flex gap-1.5">
          {dayHeaders.map((name, i) => (
            <button
              key={i}
              onClick={() => handleDayToggle(i)}
              className={`h-9 w-9 rounded-lg text-xs font-urbanist font-medium transition-all ${
                days.includes(i)
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-gray-500 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {frequency === "before_due" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={90}
            value={beforeDays}
            onChange={(e) => setBeforeDays(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="font-urbanist text-xs text-gray-400">{trans("common.daysBeforeDue")}</span>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg bg-gray-200 py-2 font-urbanist text-sm font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {trans("common.cancel")}
        </button>
        <button
          onClick={() => {
            if (frequency === "weekly" && days.length === 0) return;
            onSave({ time, frequency, days: frequency === "weekly" ? days : undefined, beforeDays: frequency === "before_due" ? beforeDays : undefined });
          }}
          className="flex-1 rounded-lg bg-primary py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
        >
          {trans("common.save")}
        </button>
      </div>
    </div>
  );
}
