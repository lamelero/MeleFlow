import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "prisma/config";

const here = path.dirname(fileURLToPath(import.meta.url));
// With a Prisma config file present, the CLI no longer auto-loads `.env`.
// Mirror the app (backend/src/config/env.ts) and read the repo-root `.env`
// so local commands (`prisma migrate deploy`, `prisma studio`) keep working.
config({ path: path.resolve(here, "../.env") });

/**
 * Prisma config file (Prisma 6.19+, replaces the deprecated
 * `package.json#prisma` block and is the supported entry point for Prisma 7).
 *
 * The datasource URL is intentionally not duplicated here: `schema.prisma`
 * already reads it from `DATABASE_URL`, and `prisma generate` must work during
 * the Docker build, where no database URL is set.
 */
export default defineConfig({
  schema: "src/prisma/schema.prisma",
  migrations: {
    path: "src/prisma/migrations",
  },
});
