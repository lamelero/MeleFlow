import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
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

describe("POST /api/habits", () => {
  it("should create a habit", async () => {
    const res = await supertest(app.server)
      .post("/api/habits")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Read daily", color: "#3B82F6" })
      .expect(201);

    expect(res.body).toMatchObject({ name: "Read daily", color: "#3B82F6" });
    habitId = res.body.id;
  });
});

describe("GET /api/habits", () => {
  it("should return habits with log dates", async () => {
    const res = await supertest(app.server)
      .get("/api/habits")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty("logs");
    expect(res.body[0]).toHaveProperty("streakCount");
  });
});

describe("POST /api/habits/:id/check", () => {
  it("should check in today", async () => {
    const res = await supertest(app.server)
      .post(`/api/habits/${habitId}/check`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("streak");
  });

  it("should return alreadyCheckedIn on duplicate", async () => {
    const res = await supertest(app.server)
      .post(`/api/habits/${habitId}/check`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.alreadyCheckedIn).toBe(true);
  });
});
