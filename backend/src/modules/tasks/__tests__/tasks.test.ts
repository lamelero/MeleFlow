import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
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

  // Register and create a list
  const reg = await supertest(app.server)
    .post("/api/auth/register")
    .send(user)
    .expect(201);

  accessToken = reg.body.accessToken;

  const listRes = await supertest(app.server)
    .post("/api/lists")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Test List", color: "#14B8A6" })
    .expect(201);

  listId = listRes.body.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: user.email } });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

describe("POST /api/tasks", () => {
  it("should create a task", async () => {
    const res = await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Buy groceries", priority: 2, listId })
      .expect(201);

    expect(res.body).toMatchObject({
      title: "Buy groceries",
      priority: 2,
      isCompleted: false,
      listId,
    });
    expect(res.body.id).toBeDefined();
  });

  it("should reject unauthenticated request", async () => {
    await supertest(app.server)
      .post("/api/tasks")
      .send({ title: "No auth" })
      .expect(401);
  });

  it("should reject empty title", async () => {
    await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "" })
      .expect(400);
  });
});

describe("GET /api/tasks", () => {
  it("should return all top-level tasks", async () => {
    const res = await supertest(app.server)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("should filter by listId", async () => {
    const res = await supertest(app.server)
      .get("/api/tasks")
      .query({ listId })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.every((t: { listId: string }) => t.listId === listId)).toBe(true);
  });

  it("should filter by status", async () => {
    const res = await supertest(app.server)
      .get("/api/tasks")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.every((t: { isCompleted: boolean }) => t.isCompleted === false)).toBe(true);
  });
});

describe("PATCH /api/tasks/:id", () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Task to update" })
      .expect(201);
    taskId = res.body.id;
  });

  it("should toggle isCompleted", async () => {
    const res = await supertest(app.server)
      .patch(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isCompleted: true })
      .expect(200);

    expect(res.body.isCompleted).toBe(true);
  });

  it("should update title", async () => {
    const res = await supertest(app.server)
      .patch(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Updated title" })
      .expect(200);

    expect(res.body.title).toBe("Updated title");
  });

  it("should return 404 for unknown task", async () => {
    await supertest(app.server)
      .patch("/api/tasks/nonexistent-id")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Nope" })
      .expect(404);
  });
});

describe("Subtask hierarchy", () => {
  let parentId: string;
  let childId: string;

  it("should create a subtask", async () => {
    const parent = await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Parent task" })
      .expect(201);
    parentId = parent.body.id;

    const child = await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Sub task", parentTaskId: parentId })
      .expect(201);
    childId = child.body.id;

    expect(child.body.parentTaskId).toBe(parentId);
  });

  it("parent should include subtasks", async () => {
    const res = await supertest(app.server)
      .get(`/api/tasks/${parentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.subTasks.length).toBe(1);
    expect(res.body.subTasks[0].id).toBe(childId);
  });

  it("subtask should not appear in top-level list", async () => {
    const res = await supertest(app.server)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(childId);
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("should delete a task", async () => {
    const res = await supertest(app.server)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Task to delete" })
      .expect(201);

    await supertest(app.server)
      .delete(`/api/tasks/${res.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await supertest(app.server)
      .get(`/api/tasks/${res.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
