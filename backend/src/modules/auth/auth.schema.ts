import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional().default(false),
});

export const verify2FASchema = z.object({
  twoFactorToken: z.string().min(1),
  code: z.string().min(1).max(20),
  trustDevice: z.boolean().optional().default(false),
});

export const refreshSchema = z.object({
  rememberMe: z.boolean().optional().default(false),
  refreshToken: z.string().optional(),
});

export const updateLanguageSchema = z.object({
  language: z.enum(["en", "es"]),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(60).optional(),
  notificationEmail: z.string().email().optional().or(z.literal("")),
  bio: z.string().max(500).optional(),
  timezone: z.string().max(50).optional(),
});

export const setup2FASchema = z.object({});

export const enable2FASchema = z.object({
  code: z.string().length(6),
});

export const disable2FASchema = z.object({
  password: z.string().min(1),
});

export const sendOTPSchema = z.object({
  twoFactorToken: z.string().min(1),
});

export const getRecoveryCodesSchema = z.object({
  password: z.string().min(1),
});

export const updateNotificationPrefsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  browser: z.boolean().optional(),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type Verify2FALoginInput = z.infer<typeof verify2FASchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
