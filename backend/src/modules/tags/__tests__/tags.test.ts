import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
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

describe("POST /api/tags", () => {
  it("should create a tag", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tags",
      ...auth(),
      payload: { name: "urgent", color: "#EF4444" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "urgent", color: "#EF4444" });
  });

  it("should reject duplicate name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tags",
      ...auth(),
      payload: { name: "urgent" },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe("GET /api/tags", () => {
  it("should return all tags", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tags",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PATCH /api/tags/:id", () => {
  it("should update a tag", async () => {
    const tags = await app.inject({
      method: "GET",
      url: "/api/tags",
      ...auth(),
    });

    const tagId = tags.json()[0].id;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/tags/${tagId}`,
      ...auth(),
      payload: { name: "critical" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("critical");
  });
});

describe("DELETE /api/tags/:id", () => {
  it("should delete a tag", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/tags",
      ...auth(),
      payload: { name: "temp", color: "#9CA3AF" },
    });

    expect(created.statusCode).toBe(201);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/tags/${created.json().id}`,
      ...auth(),
    });

    expect(del.statusCode).toBe(204);
  });
});
