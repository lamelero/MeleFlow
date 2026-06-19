import { z } from "zod";

export const frequencySchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = JSON.parse(val);
        return (
          typeof parsed === "object" &&
          ["daily", "weekly", "monthly"].includes(parsed.type) &&
          (parsed.days === undefined ||
            (Array.isArray(parsed.days) &&
              parsed.days.every((d: number) => d >= 0 && d <= 6))) &&
          (parsed.reminderTime === undefined ||
            /^\d{2}:\d{2}$/.test(parsed.reminderTime))
        );
      } catch {
        return false;
      }
    },
    { message: "Invalid frequency JSON format" },
  );

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
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
    .default("OTROS"),
  priority: z.number().int().min(1).max(5).default(1),
  frequency: frequencySchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
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
  frequency: frequencySchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  isArchived: z.boolean().optional(),
  categoryId: z.string().nullable().optional(),
});

export const progressQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["completed", "skipped", "failed"]).optional(),
});

export const habitIdParams = z.object({
  id: z.string(),
});

export const habitQuerySchema = z.object({
  archived: z.enum(["true"]).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type ProgressQuery = z.infer<typeof progressQuerySchema>;
