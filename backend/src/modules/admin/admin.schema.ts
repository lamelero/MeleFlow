import { z } from "zod";
import { Role } from "@prisma/client";

export const updateUserSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  allowRegistration: z.boolean().optional(),
  maxUploadSize: z.number().int().min(1).max(200).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
