import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
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
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body).toHaveProperty("user");
    expect(body.user).toMatchObject({
      id: expect.any(String),
      email: payload.email,
      username: payload.username,
    });
    expect(["USER", "ADMIN"]).toContain(body.user.role);
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("should reject duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("email already taken");
  });

  it("should reject invalid email format", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...payload, email: "not-an-email" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("body/email");
  });

  it("should reject short password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...payload, email: "new@test.dev", password: "short" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("body/password");
  });
});

describe("POST /api/auth/login", () => {
  it("should login with correct credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "test@taskflow.dev", password: "Password123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe("test@taskflow.dev");
  });

  it("should reject wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "test@taskflow.dev", password: "wrongpass" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid credentials");
  });

  it("should reject unknown email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "unknown@test.dev", password: "Password123!" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid credentials");
  });
});

describe("POST /api/auth/refresh", () => {
  it("should return a new access token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "test@taskflow.dev", password: "Password123!" },
    });

    const refreshToken = login.json().refreshToken;

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it("should reject invalid refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "invalid-token" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toContain("Invalid");
  });
});

describe("GET /api/auth/me", () => {
  it("should return current user with valid token", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "test@taskflow.dev", password: "Password123!" },
    });

    const accessToken = login.json().accessToken;

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      email: "test@taskflow.dev",
      username: "testuser",
    });
    expect(["USER", "ADMIN"]).toContain(body.role);
  });

  it("should reject unauthenticated request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("should logout successfully", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "test@taskflow.dev", password: "Password123!" },
    });

    const refreshToken = login.json().refreshToken;

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: `refreshToken=${refreshToken}` },
    });

    expect(logoutRes.statusCode).toBe(204);

    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });

    expect(refreshRes.statusCode).toBe(401);
  });
});
