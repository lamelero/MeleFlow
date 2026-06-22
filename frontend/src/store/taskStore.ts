import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";
import { scheduleTaskReminders } from "../capacitor/localNotifications";
import { isNative } from "../capacitor/register";
import { updateTaskData } from "../lib/browserNotifications";

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadDate: string;
}

export interface ChecklistItem {
  id?: string;
  text: string;
  isCompleted: boolean;
  position: number;
}

export interface Task {
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
  subTasks?: Task[];
  tags?: { id: string; name: string; color: string }[];
  attachments?: Attachment[];
  checklistItems?: ChecklistItem[];
  reminderEnabled?: boolean;
  reminderConfig?: string | null;
  collaborators?: { id: string; username: string; displayName: string | null; avatarUrl: string | null }[];
}

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
  fetchTasks: (filters?: TaskFilters, retry?: number) => Promise<void>;
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
  addCollaborator: (taskId: string, username: string) => Promise<void>;
  removeCollaborator: (taskId: string, collaboratorId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  sharedTasks: [],
  isLoading: false,
  error: null,
  lastFilter: null,

  fetchTasks: async (filters, retry = 0) => {
    if (retry === 0) set({ isLoading: true, error: null, lastFilter: filters || null });
    try {
      const params = new URLSearchParams();
      if (filters?.listId) params.set("listId", filters.listId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.priority) params.set("priority", String(filters.priority));
      if (filters?.tagId) params.set("tagId", filters.tagId);
      if (filters?.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
      if (filters?.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
      const qs = params.toString();
      const { data } = await client.get(`/tasks${qs ? `?${qs}` : ""}`);
      set({ tasks: data, isLoading: false, error: null });
      if (isNative()) setTimeout(() => scheduleTaskReminders(data), 0);
      updateTaskData(data);
    } catch (err) {
      if (retry < 3) {
        const delay = Math.pow(2, retry) * 1000;
        console.warn(`[taskStore] fetchTasks failed, retry ${retry + 1}/3 in ${delay}ms:`, err);
        await new Promise((r) => setTimeout(r, delay));
        return get().fetchTasks(filters, retry + 1);
      }
      const message = err instanceof Error ? err.message : "Failed to load tasks";
      console.error("[taskStore] fetchTasks error after 3 retries:", err);
      set({ error: message, isLoading: false });
    }
  },

  fetchSharedTasks: async () => {
    try {
      const { data } = await client.get("/tasks/shared");
      set({ sharedTasks: data });
    } catch {
      // silent
    }
  },

  createTask: async (input) => {
    const { data } = await client.post("/tasks", input);
    set((state) => ({
      tasks: input.parentTaskId
        ? state.tasks
        : [data, ...state.tasks],
    }));
    toast.success("Task created");
    updateTaskData(get().tasks);
    return data;
  },

  updateTask: async (id, input) => {
    const prev = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...input } : t,
      ),
    }));
    try {
      const { data } = await client.patch(`/tasks/${id}`, input);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? data : t)),
      }));
      toast.success("Task updated");
      if (isNative()) setTimeout(() => scheduleTaskReminders(get().tasks), 0);
      updateTaskData(get().tasks);
    } catch {
      set({ tasks: prev });
      toast.error("Failed to update task");
    }
  },

  toggleTask: async (id) => {
    const prev = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, isCompleted: !t.isCompleted } : t,
      ),
    }));
    try {
      const task = prev.find((t) => t.id === id);
      const completed = !task?.isCompleted;
      const { data } = await client.patch(`/tasks/${id}`, {
        isCompleted: completed,
      });
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? data : t)),
      }));
      toast.success(completed ? "Task completed" : "Task reopened");
      if (isNative()) setTimeout(() => scheduleTaskReminders(get().tasks), 0);
      updateTaskData(get().tasks);
      const lastFilter = get().lastFilter;
      if (lastFilter) get().fetchTasks(lastFilter);
    } catch {
      set({ tasks: prev });
      toast.error("Failed to update task");
    }
  },

  deleteTask: async (id) => {
    const prev = get().tasks;
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
    try {
      await client.delete(`/tasks/${id}`);
      toast.success("Task deleted");
      if (isNative()) setTimeout(() => scheduleTaskReminders(get().tasks), 0);
      updateTaskData(get().tasks);
    } catch {
      set({ tasks: prev });
      toast.error("Failed to delete task");
    }
  },

  replaceTask: (task) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
  },

  addCollaborator: async (taskId, username) => {
    const { data } = await client.post(`/tasks/${taskId}/collaborators`, { username });
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? data : t)),
    }));
    toast.success("Collaborator added");
  },

  removeCollaborator: async (taskId, collaboratorId) => {
    const { data } = await client.delete(`/tasks/${taskId}/collaborators/${collaboratorId}`);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? data : t)),
    }));
    toast.success("Collaborator removed");
  },
}));
