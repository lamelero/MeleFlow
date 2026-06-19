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
  email: "lists-test@taskflow.dev",
  username: "liststest",
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

describe("POST /api/lists", () => {
  it("should create a list", async () => {
    const res = await supertest(app.server)
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Work", color: "#3B82F6" })
      .expect(201);

    expect(res.body).toMatchObject({ name: "Work", color: "#3B82F6" });
    expect(res.body.id).toBeDefined();
  });

  it("should reject duplicate name", async () => {
    await supertest(app.server)
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Work" })
      .expect(409);
  });
});

describe("GET /api/lists", () => {
  it("should return all lists", async () => {
    const res = await supertest(app.server)
      .get("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty("_count");
  });
});

describe("PATCH /api/lists/:id", () => {
  it("should update list name and color", async () => {
    const lists = await supertest(app.server)
      .get("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const listId = lists.body[0].id;

    const res = await supertest(app.server)
      .patch(`/api/lists/${listId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Office", color: "#EF4444" })
      .expect(200);

    expect(res.body.name).toBe("Office");
    expect(res.body.color).toBe("#EF4444");
  });
});

describe("DELETE /api/lists/:id", () => {
  it("should delete a list", async () => {
    const res = await supertest(app.server)
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Temp" })
      .expect(201);

    await supertest(app.server)
      .delete(`/api/lists/${res.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await supertest(app.server)
      .get(`/api/lists/${res.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
