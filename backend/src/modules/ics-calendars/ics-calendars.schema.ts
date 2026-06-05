import { z } from "zod";

export const createIcsCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
});

export const eventsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type CreateIcsCalendarInput = z.infer<typeof createIcsCalendarSchema>;
