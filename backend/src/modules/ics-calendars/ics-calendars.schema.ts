import { z } from "zod";

export const createIcsCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  reminderBefore: z.number().int().min(0).max(1440).default(0),
  allDayReminderTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
});

export const updateIcsCalendarSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  reminderBefore: z.number().int().min(0).max(1440).optional(),
  allDayReminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const eventsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type CreateIcsCalendarInput = z.infer<typeof createIcsCalendarSchema>;
export type UpdateIcsCalendarInput = z.infer<typeof updateIcsCalendarSchema>;
