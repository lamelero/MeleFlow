// Sync protocol v1 — client types.
// These mirror the flat payloads emitted by the backend PULL/PUSH endpoints
// (see backend/src/modules/sync/sync.service.ts).

export const SYNC_ENTITIES = [
  "list",
  "tag",
  "task",
  "checklistItem",
  "taskTag",
  "habit",
  "habitCategory",
  "habitLog",
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export type SyncAction = "create" | "update" | "delete";

export const SYNC_PROTOCOL_VERSION = 1;
export const MAX_PUSH_OPERATIONS = 200;

/** Fields every syncable row carries. `version` is the server syncVersion. */
export interface SyncMeta {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: string;
}

// ── Server rows (flat) ───────────────────────────

export interface TaskRow extends SyncMeta {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  status: "todo" | "in_progress" | "completed";
  type: "TEXT" | "CHECKLIST";
  dueDate: string | null;
  rrule: string | null;
  isCompleted: boolean;
  listId: string | null;
  parentTaskId: string | null;
  reminderEnabled: boolean;
  reminderConfig: string | null;
}

export interface ListRow extends SyncMeta {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSmart: boolean;
}

export interface TagRow extends SyncMeta {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItemRow extends SyncMeta {
  id: string;
  taskId: string;
  text: string;
  isCompleted: boolean;
  position: number;
}

export interface TaskTagRow extends SyncMeta {
  id: string;
  taskId: string;
  tagId: string;
}

export interface HabitRow extends SyncMeta {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  frequency: string | null;
  startDate: string;
  endDate: string | null;
  isArchived: boolean;
  streakCount: number;
  categoryId: string | null;
}

export interface HabitCategoryRow extends SyncMeta {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface HabitLogRow extends SyncMeta {
  id: string;
  habitId: string;
  date: string;
  status: string;
  note: string | null;
}

export interface PullChanges {
  lists: ListRow[];
  tags: TagRow[];
  tasks: TaskRow[];
  checklistItems: ChecklistItemRow[];
  taskTags: TaskTagRow[];
  habits: HabitRow[];
  habitCategories: HabitCategoryRow[];
  habitLogs: HabitLogRow[];
}

export interface PullResponse {
  protocolVersion: number;
  serverRevision: string;
  cursor: string;
  resetRequired: boolean;
  hasMore: boolean;
  changes: PullChanges;
}

export interface PushResult {
  status: "applied" | "conflict" | "error";
  operationId: string;
  entity: SyncEntity;
  action: SyncAction;
  entityId: string;
  version?: string;
  data?: unknown;
  error?: string;
  code?: string;
}

export interface PushResponse {
  protocolVersion: number;
  results: PushResult[];
}

// ── Outbox ───────────────────────────────────────

export interface OutboxOperation {
  /** Auto-incremented insertion order. */
  seq?: number;
  operationId: string;
  entity: SyncEntity;
  action: SyncAction;
  entityId: string;
  /** Server version the change was based on; used for optimistic conflicts. */
  baseVersion?: string | null;
  force?: boolean;
  data?: Record<string, unknown>;
  createdAt: number;
  attempts?: number;
  error?: string;
}

// ── UI view types (rehydrated) ───────────────────

export interface AttachmentView {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadDate: string;
}

export interface ChecklistItemView {
  id?: string;
  text: string;
  isCompleted: boolean;
  position: number;
}

export interface TaskTagView {
  id: string;
  name: string;
  color: string;
}

export interface TaskView {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  priority: number;
  status: "todo" | "in_progress" | "completed";
  type: "TEXT" | "CHECKLIST";
  isCompleted: boolean;
  dueDate: string | null;
  rrule: string | null;
  listId: string | null;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  reminderEnabled?: boolean;
  reminderConfig?: string | null;
  subTasks?: TaskView[];
  tags?: TaskTagView[];
  attachments?: AttachmentView[];
  checklistItems?: ChecklistItemView[];
  collaborators?: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[];
}

export interface ListView {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isSmart?: boolean;
  _count: { tasks: number };
}

export interface TagView {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
}

export interface HabitLogView {
  date: string;
  status: string;
}

export interface HabitView {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  frequency: string | null;
  startDate: string;
  endDate: string | null;
  isArchived: boolean;
  streakCount: number;
  totalDays: number;
  completedToday: boolean;
  logs: HabitLogView[];
  categoryId?: string | null;
  habitCategory?: { id: string; name: string; icon: string; color: string } | null;
}

export interface HabitCategoryView {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  _count?: { habits: number };
}

export interface TaskFilters {
  listId?: string;
  status?: "completed" | "pending";
  priority?: number;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}
