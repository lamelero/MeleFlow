import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { FastifyInstance } from "fastify";
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

  const reg = await supertest(app.server)
    .post("/api/auth/register")
    .send(user)
    .expect(201);
  accessToken = reg.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: user.email } });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

describe("POST /api/pomodoro/start", () => {
  it("should start a new session", async () => {
    const res = await supertest(app.server)
      .post("/api/pomodoro/start")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ duration: 25 })
      .expect(201);

    expect(res.body).toMatchObject({
      state: "RUNNING",
      duration: 25,
    });
    expect(res.body.id).toBeDefined();
  });
});

describe("GET /api/pomodoro/current", () => {
  it("should return the current session", async () => {
    const res = await supertest(app.server)
      .get("/api/pomodoro/current")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.state).toBe("RUNNING");
  });
});

describe("POST /api/pomodoro/:id/pause", () => {
  it("should pause the session", async () => {
    const current = await supertest(app.server)
      .get("/api/pomodoro/current")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await supertest(app.server)
      .post(`/api/pomodoro/${current.body.id}/pause`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.state).toBe("PAUSED");
  });
});

describe("POST /api/pomodoro/:id/complete", () => {
  it("should complete the session", async () => {
    const current = await supertest(app.server)
      .get("/api/pomodoro/current")
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await supertest(app.server)
      .post(`/api/pomodoro/${current.body.id}/complete`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.state).toBe("COMPLETED");
  });
});
