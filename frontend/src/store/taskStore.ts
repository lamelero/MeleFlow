import { create } from "zustand";
import toast from "react-hot-toast";
import { client } from "../api/client";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  isCompleted: boolean;
  dueDate: string | null;
  rrule: string | null;
  listId: string | null;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  subTasks?: Task[];
  tags?: { id: string; name: string; color: string }[];
}

interface TaskFilters {
  listId?: string;
  status?: "completed" | "pending";
  priority?: number;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (filters?: TaskFilters) => Promise<void>;
  createTask: (input: {
    title: string;
    priority?: number;
    listId?: string | null;
    parentTaskId?: string | null;
    description?: string | null;
    dueDate?: string | null;
  }) => Promise<Task>;
  updateTask: (id: string, input: Partial<{
    title: string;
    description: string | null;
    priority: number;
    isCompleted: boolean;
    dueDate: string | null;
    listId: string | null;
    parentTaskId: string | null;
  }>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  replaceTask: (task: Task) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.listId) params.set("listId", filters.listId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.priority) params.set("priority", String(filters.priority));
      const qs = params.toString();
      const { data } = await client.get(`/tasks${qs ? `?${qs}` : ""}`);
      set({ tasks: data, isLoading: false });
    } catch {
      set({ error: "Failed to load tasks", isLoading: false });
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
}));
