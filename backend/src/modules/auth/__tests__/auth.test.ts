import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { FastifyInstance } from "fastify";
import type { AppInstance } from "../../../app";

let app: AppInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

describe("POST /api/auth/register", () => {
  const payload = {
    email: "test@taskflow.dev",
    username: "testuser",
    password: "Password123!",
  };

  it("should register a new user and return tokens", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/register")
      .send(payload)
      .expect(201);

    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      email: payload.email,
      username: payload.username,
      role: "USER",
    });
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
  });

  it("should reject duplicate email", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/register")
      .send(payload)
      .expect(409);

    expect(res.body.error).toBe("email already taken");
  });

  it("should reject invalid email format", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/register")
      .send({ ...payload, email: "not-an-email" })
      .expect(400);

    expect(res.body.error).toBe("Validation failed");
  });

  it("should reject short password", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/register")
      .send({ ...payload, email: "new@test.dev", password: "short" })
      .expect(400);

    expect(res.body.error).toBe("Validation failed");
  });
});

describe("POST /api/auth/login", () => {
  it("should login with correct credentials", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "test@taskflow.dev", password: "Password123!" })
      .expect(200);

    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.email).toBe("test@taskflow.dev");
  });

  it("should reject wrong password", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "test@taskflow.dev", password: "wrongpass" })
      .expect(401);

    expect(res.body.error).toBe("Invalid credentials");
  });

  it("should reject unknown email", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "unknown@test.dev", password: "Password123!" })
      .expect(401);

    expect(res.body.error).toBe("Invalid credentials");
  });
});

describe("POST /api/auth/refresh", () => {
  it("should return a new access token", async () => {
    const login = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "test@taskflow.dev", password: "Password123!" });

    const refreshToken = login.body.refreshToken;

    const res = await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    // Token should be rotated
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("should reject invalid refresh token", async () => {
    const res = await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken: "invalid-token" })
      .expect(401);

    expect(res.body.error).toBe("Invalid refresh token");
  });
});

describe("GET /api/auth/me", () => {
  it("should return current user with valid token", async () => {
    const login = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "test@taskflow.dev", password: "Password123!" });

    const accessToken = login.body.accessToken;

    const res = await supertest(app.server)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      email: "test@taskflow.dev",
      username: "testuser",
      role: "USER",
    });
  });

  it("should reject unauthenticated request", async () => {
    await supertest(app.server)
      .get("/api/auth/me")
      .expect(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("should logout successfully", async () => {
    const login = await supertest(app.server)
      .post("/api/auth/login")
      .send({ email: "test@taskflow.dev", password: "Password123!" });

    const refreshToken = login.body.refreshToken;

    await supertest(app.server)
      .post("/api/auth/logout")
      .send({ refreshToken })
      .expect(204);

    // Token should no longer be valid for refresh
    await supertest(app.server)
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });
});
