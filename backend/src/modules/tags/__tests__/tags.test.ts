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
  email: "tags-test@taskflow.dev",
  username: "tagstest",
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

describe("POST /api/tags", () => {
  it("should create a tag", async () => {
    const res = await supertest(app.server)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "urgent", color: "#EF4444" })
      .expect(201);

    expect(res.body).toMatchObject({ name: "urgent", color: "#EF4444" });
  });

  it("should reject duplicate name", async () => {
    await supertest(app.server)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "urgent" })
      .expect(409);
  });
});

describe("GET /api/tags", () => {
  it("should return all tags", async () => {
    const res = await supertest(app.server)
      .get("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PATCH /api/tags/:id", () => {
  it("should update a tag", async () => {
    const tags = await supertest(app.server)
      .get("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`);
    const tagId = tags.body[0].id;

    const res = await supertest(app.server)
      .patch(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "critical" })
      .expect(200);

    expect(res.body.name).toBe("critical");
  });
});

describe("DELETE /api/tags/:id", () => {
  it("should delete a tag", async () => {
    const res = await supertest(app.server)
      .post("/api/tags")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "temp", color: "#9CA3AF" })
      .expect(201);

    await supertest(app.server)
      .delete(`/api/tags/${res.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });
});
