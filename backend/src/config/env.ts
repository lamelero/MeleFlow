import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

export const env = z
  .object({
    DATABASE_URL: z.string(),
    REDIS_URL: z.string(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    FRONTEND_URL: z.string().default("http://localhost:5173"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ENCRYPTION_KEY: z.string().min(32),
    ALLOW_REGISTRATION: z
      .string()
      .default("true")
      .transform((v) => v === "true"),
    MAX_UPLOAD_SIZE: z.coerce.number().default(50),
    MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().default(15),
    CORS_ORIGIN: z.string().optional(),
  })
  .parse(process.env);
