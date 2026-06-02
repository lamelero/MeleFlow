import { z } from "zod";
import { Role } from "@prisma/client";

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  storageQuota: z.number().int().min(1).max(1073741824).nullable().optional(),
});

export const updateSettingsSchema = z.object({
  allowRegistration: z.boolean().optional(),
  maxUploadSize: z.number().int().min(1).max(200).optional(),
  maxStoragePerUser: z.number().int().min(1).max(1073741824).optional(),
  maxLoginAttempts: z.number().int().min(1).max(100).optional(),
  loginLockoutMinutes: z.number().int().min(1).max(1440).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string().email().optional().or(z.literal("")),
  emailEnabled: z.boolean().optional(),
  emailSubject: z.string().max(200).optional(),
  logoUrl: z.string().optional(),
  frontendUrl: z.string().url().max(200).optional(),
  backupInterval: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
  backupRetention: z.number().int().min(1).max(100).optional(),
  backupEncrypted: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
