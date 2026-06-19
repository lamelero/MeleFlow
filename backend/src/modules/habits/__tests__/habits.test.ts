import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let accessToken: string;
let habitId: string;

const user = {
  email: "habits-test@taskflow.dev",
  username: "habitstest",
  password: "Password123!",
};

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: user,
  });
  accessToken = reg.json().accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: user.email } });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

const auth = () => ({ headers: { authorization: `Bearer ${accessToken}` } });

describe("POST /api/habits", () => {
  it("should create a habit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits",
      ...auth(),
      payload: { name: "Read daily" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Read daily" });
    habitId = res.json().id;
  });
});

describe("GET /api/habits", () => {
  it("should return habits with log dates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/habits",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0]).toHaveProperty("logs");
    expect(body[0]).toHaveProperty("streakCount");
  });
});

describe("POST /api/habits/:id/progress", () => {
  it("should check in today", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/progress`,
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("streak");
  });

  it("should return alreadyCheckedIn on duplicate", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/progress`,
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().alreadyCheckedIn).toBe(true);
  });
});
