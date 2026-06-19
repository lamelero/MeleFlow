import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
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

describe("POST /api/lists", () => {
  it("should create a list", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/lists",
      ...auth(),
      payload: { name: "Work", color: "#3B82F6" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Work", color: "#3B82F6" });
    expect(res.json().id).toBeDefined();
  });

  it("should reject duplicate name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/lists",
      ...auth(),
      payload: { name: "Work" },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe("GET /api/lists", () => {
  it("should return all lists", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/lists",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).toHaveProperty("_count");
  });
});

describe("PATCH /api/lists/:id", () => {
  it("should update list name and color", async () => {
    const lists = await app.inject({
      method: "GET",
      url: "/api/lists",
      ...auth(),
    });

    const listId = lists.json()[0].id;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/lists/${listId}`,
      ...auth(),
      payload: { name: "Office", color: "#EF4444" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Office");
    expect(res.json().color).toBe("#EF4444");
  });
});

describe("DELETE /api/lists/:id", () => {
  it("should delete a list", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/lists",
      ...auth(),
      payload: { name: "Temp" },
    });

    const listId = created.json().id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/lists/${listId}`,
      ...auth(),
    });

    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/api/lists/${listId}`,
      ...auth(),
    });

    expect(get.statusCode).toBe(404);
  });
});
