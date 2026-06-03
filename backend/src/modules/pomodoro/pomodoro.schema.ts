import { z } from "zod";

export const startSessionSchema = z.object({
  duration: z.number().int().min(1).max(180).optional(),
  type: z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]).optional(),
  taskId: z.string().nullable().optional(),
});

export const updateSettingsSchema = z.object({
  pomodoroWork: z.number().int().min(1).max(120).optional(),
  pomodoroShortBreak: z.number().int().min(1).max(30).optional(),
  pomodoroLongBreak: z.number().int().min(1).max(60).optional(),
  pomodoroCycles: z.number().int().min(1).max(10).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
