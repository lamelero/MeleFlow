import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";
import { scheduleTaskReminders } from "../capacitor/localNotifications";
import { isNative } from "../capacitor/register";
import { updateTaskData } from "../lib/browserNotifications";
import { newId } from "../sync/ids";
import {
  coalesceUpdate,
  enqueue,
  enqueueDelete,
  findPendingOps,
  removeOperations,
  removePendingWhere,
} from "../sync/queue";
import {
  deleteRow,
  getAllRows,
  getRow,
  knownBaseVersion,
  localMeta,
  putRow,
  selectTasks,
} from "../sync/repository";
import { useSyncStore } from "../sync/syncStore";
import type {
  AttachmentView,
  ChecklistItemRow,
  ChecklistItemView,
  TaskRow,
  TaskTagRow,
  TaskView,
} from "../sync/types";

export type Attachment = AttachmentView;
export type ChecklistItem = ChecklistItemView;
export type Task = TaskView;

interface TaskFilters {
  listId?: string;
  status?: "completed" | "pending";
  priority?: number;
  tagId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface TaskState {
  tasks: Task[];
  sharedTasks: Task[];
  isLoading: boolean;
  error: string | null;
  lastFilter: TaskFilters | null;
  fetchTasks: (filters?: TaskFilters) => Promise<void>;
  fetchSharedTasks: () => Promise<void>;
  createTask: (input: {
    title: string;
    priority?: number;
    type?: "TEXT" | "CHECKLIST";
    listId?: string | null;
    parentTaskId?: string | null;
    description?: string | null;
    dueDate?: string | null;
    checklistItems?: ChecklistItem[];
  }) => Promise<Task>;
  updateTask: (id: string, input: Partial<{
    title: string;
    description: string | null;
    priority: number;
    status: "todo" | "in_progress" | "completed";
    type: "TEXT" | "CHECKLIST";
    isCompleted: boolean;
    dueDate: string | null;
    listId: string | null;
    parentTaskId: string | null;
    checklistItems: ChecklistItem[];
    reminderEnabled: boolean;
    reminderConfig: string | null;
  }>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  replaceTask: (task: Task) => void;
  addTag: (taskId: string, tagId: string) => Promise<Task | null>;
  removeTag: (taskId: string, tagId: string) => Promise<Task | null>;
  addCollaborator: (taskId: string, username: string) => Promise<void>;
  removeCollaborator: (taskId: string, collaboratorId: string) => Promise<void>;
}

function scheduleReminders(tasks: Task[]) {
  if (isNative()) setTimeout(() => scheduleTaskReminders(tasks), 0);
}

// Attachments are online-only (not part of the sync protocol). Keep them in a
// session cache so rehydrating the synced fields does not drop them from the
// detail panel.
const attachmentCache = new Map<string, Attachment[]>();

function withAttachments(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    const cached = attachmentCache.get(task.id);
    return cached ? { ...task, attachments: cached } : task;
  });
}

export const useTaskStore = create<TaskState>((set, get) => {
  async function reload(filters?: TaskFilters) {
    const tasks = withAttachments(await selectTasks(filters));
    set({ tasks, isLoading: false, error: null });
    scheduleReminders(tasks);
    updateTaskData(tasks);
    return tasks;
  }

  return {
    tasks: [],
    sharedTasks: [],
    isLoading: false,
    error: null,
    lastFilter: null,

    fetchTasks: async (filters) => {
      set({ isLoading: true, error: null, lastFilter: filters ?? null });
      try {
        await reload(filters);
        const { initialized, online, scheduleSync } = useSyncStore.getState();
        if (initialized && online) scheduleSync(300);
      } catch {
        set({ error: "Failed to load tasks", isLoading: false });
      }
    },

    fetchSharedTasks: async () => {
      try {
        const { data } = await client.get("/tasks/shared");
        set({ sharedTasks: data });
      } catch {
        // Shared tasks are online-only; keep the last known list.
      }
    },

    createTask: async (input) => {
      const id = newId();
      const row: TaskRow = {
        ...localMeta(),
        id,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 4,
        status: "todo",
        type: input.type ?? "TEXT",
        dueDate: input.dueDate ?? null,
        rrule: null,
        isCompleted: false,
        listId: input.listId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        reminderEnabled: false,
        reminderConfig: null,
      };
      await putRow("tasks", row);
      await enqueue({
        entity: "task",
        action: "create",
        entityId: id,
        data: {
          title: row.title,
          description: row.description,
          priority: row.priority,
          status: row.status,
          type: row.type,
          dueDate: row.dueDate,
          listId: row.listId,
          parentTaskId: row.parentTaskId,
        },
      });

      if (input.checklistItems?.length) {
        for (const [i, item] of input.checklistItems.entries()) {
          const cid = item.id ?? newId();
          const position = item.position ?? i;
          await putRow("checklistItems", {
            ...localMeta(),
            id: cid,
            taskId: id,
            text: item.text,
            isCompleted: item.isCompleted,
            position,
          });
          await enqueue({
            entity: "checklistItem",
            action: "create",
            entityId: cid,
            data: { taskId: id, text: item.text, isCompleted: item.isCompleted, position },
          });
        }
      }

      useSyncStore.getState().scheduleSync();
      const tasks = await reload(get().lastFilter ?? undefined);
      toast.success("Task created");
      return tasks.find((t) => t.id === id) ?? ({ ...row, userId: "", subTasks: [], tags: [], checklistItems: [], attachments: [] } as Task);
    },

    updateTask: async (id, input) => {
      const row = await getRow<TaskRow>("tasks", id);
      if (!row) return;
      const now = new Date().toISOString();

      const data: Record<string, unknown> = {};
      const scalarKeys = [
        "title",
        "description",
        "priority",
        "status",
        "type",
        "isCompleted",
        "dueDate",
        "listId",
        "parentTaskId",
        "reminderEnabled",
        "reminderConfig",
      ] as const;
      for (const key of scalarKeys) {
        if (input[key] !== undefined) data[key] = input[key];
      }

      if (Object.keys(data).length > 0) {
        await putRow("tasks", { ...row, ...data, updatedAt: now });
        await coalesceUpdate("task", id, data, knownBaseVersion(row.version));
      }

      if (input.checklistItems) {
        await syncChecklistItems(id, input.checklistItems, now);
      }

      useSyncStore.getState().scheduleSync();
      await reload(get().lastFilter ?? undefined);
      toast.success("Task updated");
    },

    toggleTask: async (id) => {
      const row = await getRow<TaskRow>("tasks", id);
      if (!row) return;
      const isCompleted = !row.isCompleted;
      await putRow("tasks", { ...row, isCompleted, updatedAt: new Date().toISOString() });
      await coalesceUpdate("task", id, { isCompleted }, knownBaseVersion(row.version));
      useSyncStore.getState().scheduleSync();
      await reload(get().lastFilter ?? undefined);
      toast.success(isCompleted ? "Task completed" : "Task reopened");
    },

    deleteTask: async (id) => {
      const row = await getRow<TaskRow>("tasks", id);
      const all = await getAllRows<TaskRow>("tasks");
      const treeIds = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of all) {
          if (t.parentTaskId && treeIds.has(t.parentTaskId) && !treeIds.has(t.id)) {
            treeIds.add(t.id);
            grew = true;
          }
        }
      }

      for (const tid of treeIds) {
        attachmentCache.delete(tid);
        await deleteRow("tasks", tid);
      }
      const items = await getAllRows<ChecklistItemRow>("checklistItems");
      await Promise.all(items.filter((c) => treeIds.has(c.taskId)).map((c) => deleteRow("checklistItems", c.id)));
      const links = await getAllRows<TaskTagRow>("taskTags");
      await Promise.all(links.filter((l) => treeIds.has(l.taskId)).map((l) => deleteRow("taskTags", l.id)));

      // Child tasks and children rows that only existed locally would otherwise
      // leave orphaned create operations pointing at a deleted parent.
      for (const tid of treeIds) {
        if (tid !== id) await removePendingWhere("task", (op) => op.entityId === tid);
      }
      await removePendingWhere("checklistItem", (op) => treeIds.has(String(op.data?.taskId ?? "")));
      await removePendingWhere("taskTag", (op) => treeIds.has(String(op.data?.taskId ?? "")));

      await enqueueDelete("task", id, knownBaseVersion(row?.version));
      useSyncStore.getState().scheduleSync();
      await reload(get().lastFilter ?? undefined);
      toast.success("Task deleted");
    },

    replaceTask: (task) => {
      if (task.attachments) attachmentCache.set(task.id, task.attachments);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
      }));
    },

    addTag: async (taskId, tagId) => {
      const linkId = `${taskId}:${tagId}`;
      // A queued delete for this link is superseded by the re-add.
      const pending = await findPendingOps("taskTag", linkId);
      if (pending.length > 0) await removeOperations(pending.map((op) => op.seq as number));

      await putRow("taskTags", { ...localMeta(), id: linkId, taskId, tagId });
      await enqueue({ entity: "taskTag", action: "create", entityId: linkId, data: { taskId, tagId } });
      useSyncStore.getState().scheduleSync();
      const tasks = await reload(get().lastFilter ?? undefined);
      return tasks.find((t) => t.id === taskId) ?? null;
    },

    removeTag: async (taskId, tagId) => {
      const linkId = `${taskId}:${tagId}`;
      const link = await getRow<TaskTagRow>("taskTags", linkId);
      await deleteRow("taskTags", linkId);
      await enqueueDelete("taskTag", linkId, knownBaseVersion(link?.version));
      useSyncStore.getState().scheduleSync();
      const tasks = await reload(get().lastFilter ?? undefined);
      return tasks.find((t) => t.id === taskId) ?? null;
    },

    addCollaborator: async (taskId, username) => {
      const { data } = await client.post(`/tasks/${taskId}/collaborators`, { username });
      set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? data : t)) }));
      toast.success("Collaborator added");
    },

    removeCollaborator: async (taskId, collaboratorId) => {
      const { data } = await client.delete(`/tasks/${taskId}/collaborators/${collaboratorId}`);
      set((state) => ({ tasks: state.tasks.map((t) => (t.id === taskId ? data : t)) }));
      toast.success("Collaborator removed");
    },
  };
});

/** Diffs the desired checklist against the local rows and queues the deltas. */
async function syncChecklistItems(taskId: string, incoming: ChecklistItem[], now: string): Promise<void> {
  const existing = (await getAllRows<ChecklistItemRow>("checklistItems")).filter((c) => c.taskId === taskId);
  const existingById = new Map(existing.map((c) => [c.id, c]));
  const incomingIds = new Set(incoming.filter((c) => c.id).map((c) => c.id as string));

  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await deleteRow("checklistItems", row.id);
      await enqueueDelete("checklistItem", row.id, knownBaseVersion(row.version));
    }
  }

  for (const [i, item] of incoming.entries()) {
    const position = item.position ?? i;
    if (item.id && existingById.has(item.id)) {
      const row = existingById.get(item.id) as ChecklistItemRow;
      await putRow("checklistItems", {
        ...row,
        text: item.text,
        isCompleted: item.isCompleted,
        position,
        updatedAt: now,
      });
      await coalesceUpdate(
        "checklistItem",
        item.id,
        { text: item.text, isCompleted: item.isCompleted, position },
        knownBaseVersion(row.version),
      );
    } else {
      const cid = item.id ?? newId();
      await putRow("checklistItems", {
        ...localMeta(new Date(now)),
        id: cid,
        taskId,
        text: item.text,
        isCompleted: item.isCompleted,
        position,
      });
      await enqueue({
        entity: "checklistItem",
        action: "create",
        entityId: cid,
        data: { taskId, text: item.text, isCompleted: item.isCompleted, position },
      });
    }
  }
}

useSyncStore.subscribe((state, prev) => {
  if (state.dataVersion !== prev.dataVersion) {
    const filters = useTaskStore.getState().lastFilter ?? undefined;
    void selectTasks(filters).then((rows) => {
      const tasks = withAttachments(rows);
      useTaskStore.setState({ tasks });
      updateTaskData(tasks);
    });
  }
});
