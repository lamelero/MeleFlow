import { z } from "zod";

export const startSessionSchema = z.object({
  duration: z.number().int().min(1).max(180).default(25),
  taskId: z.string().nullable().optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
