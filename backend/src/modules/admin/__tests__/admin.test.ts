import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { FastifyInstance } from "fastify";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let adminToken: string;
let userToken: string;

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
  await supertest(app.server).post("/api/auth/register").send(regularUser);

  // Register and promote admin
  const reg = await supertest(app.server)
    .post("/api/auth/register")
    .send(adminUser);

  adminToken = reg.body.accessToken;

  // Find admin user and promote
  const adminDb = await prisma.user.findUnique({
    where: { email: adminUser.email },
  });
  await prisma.user.update({
    where: { id: adminDb!.id },
    data: { role: "ADMIN" },
  });

  // Re-login to get token with ADMIN role
  const login = await supertest(app.server)
    .post("/api/auth/login")
    .send({ email: adminUser.email, password: adminUser.password });
  adminToken = login.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [adminUser.email, regularUser.email] } },
  });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

describe("GET /api/admin/stats", () => {
  it("should return stats for admin", async () => {
    const res = await supertest(app.server)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("totalUsers");
    expect(res.body).toHaveProperty("totalTasks");
    expect(res.body).toHaveProperty("completionRate");
  });

  it("should reject non-admin users", async () => {
    const login = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: regularUser.email, password: regularUser.password });

    await supertest(app.server)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);
  });
});

describe("GET /api/admin/users", () => {
  it("should return user list for admin", async () => {
    const res = await supertest(app.server)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty("_count");
  });
});

describe("PUT /api/admin/users/:id", () => {
  it("should update user role", async () => {
    const target = await prisma.user.findUnique({
      where: { email: regularUser.email },
    });

    const res = await supertest(app.server)
      .put(`/api/admin/users/${target!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "ADMIN" })
      .expect(200);

    expect(res.body.role).toBe("ADMIN");

    // Revert
    await supertest(app.server)
      .put(`/api/admin/users/${target!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "USER" })
      .expect(200);
  });

  it("should prevent self-demotion", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: adminUser.email },
    });

    await supertest(app.server)
      .put(`/api/admin/users/${admin!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "USER" })
      .expect(400);
  });
});
