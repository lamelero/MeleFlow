import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let adminToken: string;

const adminUser = {
  email: "admin-test@taskflow.dev",
  username: "admintest",
  password: "Password123!",
};

const regularUser = {
  email: "regular-test@taskflow.dev",
  username: "regulartest",
  password: "Password123!",
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register regular user
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: regularUser,
  });

  // Register admin user (first user gets ADMIN role automatically)
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: adminUser,
  });
  adminToken = reg.json().accessToken;

  // Promote to ADMIN (the first registered user gets ADMIN automatically,
  // but since regularUser registered first, adminUser is USER. We need to promote)
  const adminDb = await prisma.user.findUnique({
    where: { email: adminUser.email },
  });
  await prisma.user.update({
    where: { id: adminDb!.id },
    data: { role: "ADMIN" },
  });

  // Re-login to get token with ADMIN role
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: adminUser.email, password: adminUser.password },
  });
  adminToken = login.json().accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [adminUser.email, regularUser.email] } },
  });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

describe("GET /api/admin/stats", () => {
  it("should return stats for admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      ...auth(adminToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("totalUsers");
    expect(res.json()).toHaveProperty("totalTasks");
    expect(res.json()).toHaveProperty("completionRate");
  });

  it("should reject non-admin users", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: regularUser.email, password: regularUser.password },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      ...auth(login.json().accessToken),
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/admin/users", () => {
  it("should return user list for admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      ...auth(adminToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0]).toHaveProperty("_count");
  });
});

describe("PUT /api/admin/users/:id", () => {
  it("should update user role", async () => {
    const target = await prisma.user.findUnique({
      where: { email: regularUser.email },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${target!.id}`,
      ...auth(adminToken),
      payload: { role: "ADMIN" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("ADMIN");

    // Revert
    const revert = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${target!.id}`,
      ...auth(adminToken),
      payload: { role: "USER" },
    });

    expect(revert.statusCode).toBe(200);
  });

  it("should prevent self-demotion", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: adminUser.email },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${admin!.id}`,
      ...auth(adminToken),
      payload: { role: "USER" },
    });

    expect(res.statusCode).toBe(400);
  });
});
