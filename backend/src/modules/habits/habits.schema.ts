import { z } from "zod";

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#14B8A6"),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
