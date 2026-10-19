import { z } from "zod";
import { MAX_PUSH_OPERATIONS, SYNC_ACTIONS, SYNC_ENTITIES } from "./sync.constants";

const id = z.string().min(1).max(200);

// ── Pull ─────────────────────────────────────────

export const pullQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/, "cursor must be a non-negative integer")
    .optional(),
  deviceId: z.string().min(1).max(200).optional(),
});

// ── Push envelope ────────────────────────────────

export const syncOperationSchema = z.object({
  operationId: id,
  entity: z.enum(SYNC_ENTITIES),
  action: z.enum(SYNC_ACTIONS),
  entityId: id,
  baseVersion: z
    .string()
    .regex(/^\d+$/, "baseVersion must be a non-negative integer")
    .nullable()
    .optional(),
  force: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const pushBodySchema = z.object({
  deviceId: z.string().min(1).max(200).optional(),
  operations: z.array(syncOperationSchema).min(1).max(MAX_PUSH_OPERATIONS),
});

export type PullQuery = z.infer<typeof pullQuerySchema>;
export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
export type PushBody = z.infer<typeof pushBodySchema>;

// ── Entity payload validation (used by the service) ──

const taskBase = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  status: z.enum(["todo", "in_progress", "completed"]).optional(),
  type: z.enum(["TEXT", "CHECKLIST"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  rrule: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  listId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderConfig: z.string().nullable().optional(),
});

export const taskCreateData = taskBase;
export const taskUpdateData = taskBase.partial();

const listBase = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(32).optional(),
  icon: z.string().max(80).nullable().optional(),
  isSmart: z.boolean().optional(),
});

export const listCreateData = listBase;
export const listUpdateData = listBase.partial();

const tagBase = z.object({
  name: z.string().min(1).max(60),
  color: z.string().max(32).optional(),
});

export const tagCreateData = tagBase;
export const tagUpdateData = tagBase.partial();

const checklistBase = z.object({
  text: z.string().min(1).max(500),
  isCompleted: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const checklistItemCreateData = checklistBase.extend({
  taskId: z.string().min(1),
});
export const checklistItemUpdateData = checklistBase.partial();

export const taskTagCreateData = z.object({
  taskId: z.string().min(1),
  tagId: z.string().min(1),
});

const habitBase = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  category: z
    .enum([
      "DEJAR_HABITO",
      "ARTE",
      "TAREA",
      "MEDITACION",
      "ESTUDIO",
      "TRABAJO",
      "DEPORTE",
      "ENTRETENIMIENTO",
      "SOCIAL",
      "FINANZAS",
      "SALUD",
      "NUTRICION",
      "HOGAR",
      "AIRE_LIBRE",
      "OTROS",
    ])
    .optional(),
  priority: z.number().int().min(1).max(5).optional(),
  frequency: z.string().nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  isArchived: z.boolean().optional(),
  streakCount: z.number().int().min(0).optional(),
  categoryId: z.string().nullable().optional(),
});

export const habitCreateData = habitBase;
export const habitUpdateData = habitBase.partial();

const habitCategoryBase = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  order: z.number().int().optional(),
});

export const habitCategoryCreateData = habitCategoryBase;
export const habitCategoryUpdateData = habitCategoryBase.partial();

const habitLogBase = z.object({
  date: z.coerce.date(),
  status: z.enum(["completed", "skipped", "failed"]).optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const habitLogCreateData = habitLogBase.extend({
  habitId: z.string().min(1),
});
export const habitLogUpdateData = habitLogBase.partial();
