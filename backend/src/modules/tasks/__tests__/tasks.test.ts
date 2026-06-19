import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let accessToken: string;
let listId: string;

const user = {
  email: "tasks-test@taskflow.dev",
  username: "taskstest",
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

  const listRes = await app.inject({
    method: "POST",
    url: "/api/lists",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { name: "Test List", color: "#14B8A6" },
  });
  listId = listRes.json().id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: user.email } });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

const auth = () => ({ headers: { authorization: `Bearer ${accessToken}` } });

describe("POST /api/tasks", () => {
  it("should create a task", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "Buy groceries", priority: 2, listId },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      title: "Buy groceries",
      priority: 2,
      isCompleted: false,
      listId,
    });
    expect(body.id).toBeDefined();
  });

  it("should reject unauthenticated request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      payload: { title: "No auth" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should reject empty title", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("should return all top-level tasks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tasks",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("should filter by listId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tasks",
      ...auth(),
      query: { listId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().every((t: { listId: string }) => t.listId === listId)).toBe(true);
  });

  it("should filter by status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tasks",
      ...auth(),
      query: { status: "pending" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().every((t: { isCompleted: boolean }) => t.isCompleted === false)).toBe(true);
  });
});

describe("PATCH /api/tasks/:id", () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "Task to update" },
    });
    taskId = res.json().id;
  });

  it("should toggle isCompleted", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}`,
      ...auth(),
      payload: { isCompleted: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().isCompleted).toBe(true);
  });

  it("should update title", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${taskId}`,
      ...auth(),
      payload: { title: "Updated title" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Updated title");
  });

  it("should return 404 for unknown task", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/tasks/nonexistent-id",
      ...auth(),
      payload: { title: "Nope" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("Subtask hierarchy", () => {
  let parentId: string;
  let childId: string;

  it("should create a subtask", async () => {
    const parent = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "Parent task" },
    });

    expect(parent.statusCode).toBe(201);
    parentId = parent.json().id;

    const child = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "Sub task", parentTaskId: parentId },
    });

    expect(child.statusCode).toBe(201);
    childId = child.json().id;
    expect(child.json().parentTaskId).toBe(parentId);
  });

  it("parent should include subtasks", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/tasks/${parentId}`,
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().subTasks.length).toBe(1);
    expect(res.json().subTasks[0].id).toBe(childId);
  });

  it("subtask should not appear in top-level list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/tasks",
      ...auth(),
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: { id: string }) => t.id);
    expect(ids).not.toContain(childId);
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("should delete a task", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/tasks",
      ...auth(),
      payload: { title: "Task to delete" },
    });

    const taskId = created.json().id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/tasks/${taskId}`,
      ...auth(),
    });

    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/api/tasks/${taskId}`,
      ...auth(),
    });

    expect(get.statusCode).toBe(404);
  });
});
