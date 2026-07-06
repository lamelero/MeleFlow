import { execSync } from "child_process";

const TEST_DB = "taskflow_test";
const HOST_DB_URL = process.env.DATABASE_URL || "postgresql://taskflow:taskflow@localhost:5432/taskflow";
const HOST_REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const testDbUrl = HOST_DB_URL.replace(/\/[^/]+$/, `/${TEST_DB}`);
const testRedisUrl = HOST_REDIS_URL.replace(/\/\d*$/, "/1");

process.env.DATABASE_URL = testDbUrl;
process.env.REDIS_URL = testRedisUrl;
process.env.JWT_SECRET = "test-jwt-secret-min-16-chars!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-16-chars!";
process.env.ENCRYPTION_KEY = "test-encryption-key-32chars!!!!!!!";
process.env.CORS_ORIGIN = "http://localhost:5173";

export async function setup() {
  // Create test database and apply migrations
  try {
    const baseUrl = HOST_DB_URL.replace(/\/[^/]+$/, "/postgres");
    execSync(
      `psql "${baseUrl}" -tc "SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'" | grep -q 1 || psql "${baseUrl}" -c "CREATE DATABASE ${TEST_DB}"`,
      { stdio: "pipe", timeout: 10000 },
    );
  } catch {
    // ignore - db may already exist
  }
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", timeout: 30000 });
  } catch {
    // migrations may already be applied
  }
}

export async function teardown() {}
