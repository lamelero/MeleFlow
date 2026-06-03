import { z } from "zod";

export const checklistItemSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(500),
  isCompleted: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: z.number().int().min(1).max(4).default(4),
  type: z.enum(["TEXT", "CHECKLIST"]).default("TEXT"),
  dueDate: z.string().datetime().nullable().optional(),
  rrule: z.string().nullable().optional(),
  listId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderConfig: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  isCompleted: z.boolean().optional(),
  type: z.enum(["TEXT", "CHECKLIST"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  rrule: z.string().nullable().optional(),
  listId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderConfig: z.string().nullable().optional(),
});

export const taskQuerySchema = z.object({
  listId: z.string().optional(),
  status: z.enum(["completed", "pending"]).optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  tagId: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
});

export const taskTagSchema = z.object({
  tagId: z.string().min(1),
});

export const addCollaboratorSchema = z.object({
  username: z.string().min(1).max(50),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TaskTagInput = z.infer<typeof taskTagSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
