import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let accessToken: string;

const user = {
  email: "pomodoro-test@taskflow.dev",
  username: "pomodorotest",
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

describe("POST /api/pomodoro/start", () => {
  it("should start a new session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/pomodoro/start",
      ...auth(),
      payload: { duration: 25 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      state: "RUNNING",
      duration: 25,
    });
    expect(res.json().id).toBeDefined();
  });
});

describe("GET /api/pomodoro/current", () => {
  it("should return the current session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/pomodoro/current",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe("RUNNING");
  });
});

describe("POST /api/pomodoro/:id/pause", () => {
  it("should pause the session", async () => {
    const current = await app.inject({
      method: "GET",
      url: "/api/pomodoro/current",
      ...auth(),
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/pomodoro/${current.json().id}/pause`,
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe("PAUSED");
  });
});

describe("POST /api/pomodoro/:id/complete", () => {
  it("should complete the session", async () => {
    const current = await app.inject({
      method: "GET",
      url: "/api/pomodoro/current",
      ...auth(),
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/pomodoro/${current.json().id}/complete`,
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe("COMPLETED");
  });
});
