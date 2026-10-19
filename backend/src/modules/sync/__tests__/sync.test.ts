import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../app";
import { prisma } from "../../../config/database";
import { redis } from "../../../config/redis";
import type { AppInstance } from "../../../app";

let app: AppInstance;
let accessToken: string;

const run = Date.now().toString(36);

const user = {
  email: `sync-test-${run}@taskflow.dev`,
  username: `synctest${run}`,
  password: "Password123!",
};

const ids = {
  list: `list-${run}`,
  tag: `tag-${run}`,
  task: `task-${run}`,
  checklist: `check-${run}`,
  habitCategory: `hcat-${run}`,
  habit: `habit-${run}`,
  habitLog: `hlog-${run}`,
};

let cursorAfterCreate = "0";

type PushOperation = {
  operationId: string;
  entity: string;
  action: string;
  entityId: string;
  baseVersion?: string | null;
  force?: boolean;
  data?: Record<string, unknown>;
};

const auth = () => ({ headers: { authorization: `Bearer ${accessToken}` } });

async function push(operations: PushOperation[]) {
  const res = await app.inject({
    method: "POST",
    url: "/api/sync/push",
    ...auth(),
    payload: { deviceId: "test-device", operations },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    protocolVersion: number;
    results: Array<{
      status: "applied" | "conflict" | "error";
      operationId: string;
      entity: string;
      action: string;
      entityId: string;
      version?: string;
      data?: Record<string, unknown>;
      error?: string;
      code?: string;
    }>;
  };
}

async function pull(cursor?: string) {
  const res = await app.inject({
    method: "GET",
    url: "/api/sync/pull",
    ...auth(),
    query: cursor !== undefined ? { cursor, deviceId: "test-device" } : { deviceId: "test-device" },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    protocolVersion: number;
    serverRevision: string;
    cursor: string;
    resetRequired: boolean;
    hasMore: boolean;
    changes: Record<string, Array<Record<string, unknown>>>;
  };
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  await prisma.user.deleteMany({ where: { email: user.email } });

  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: user,
  });
  expect(reg.statusCode).toBe(201);
  accessToken = reg.json().accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: user.email } });
  await prisma.$disconnect();
  await redis.quit();
  await app.close();
});

describe("sync protocol v1", () => {
  it("returns an empty full snapshot for a brand-new user", async () => {
    const body = await pull();
    expect(body.protocolVersion).toBe(1);
    expect(body.serverRevision).toBe("0");
    expect(body.resetRequired).toBe(false);
    for (const rows of Object.values(body.changes)) {
      expect(rows).toEqual([]);
    }
  });

  it("applies a batch of offline creates", async () => {
    const body = await push([
      {
        operationId: `op-list-${run}`,
        entity: "list",
        action: "create",
        entityId: ids.list,
        data: { name: `Sync List ${run}`, color: "#14B8A6" },
      },
      {
        operationId: `op-tag-${run}`,
        entity: "tag",
        action: "create",
        entityId: ids.tag,
        data: { name: `Sync Tag ${run}`, color: "#EF4444" },
      },
      {
        operationId: `op-task-${run}`,
        entity: "task",
        action: "create",
        entityId: ids.task,
        data: { title: "Offline task", priority: 2, listId: ids.list },
      },
      {
        operationId: `op-check-${run}`,
        entity: "checklistItem",
        action: "create",
        entityId: ids.checklist,
        data: { taskId: ids.task, text: "Step one", position: 0 },
      },
      {
        operationId: `op-tasktag-${run}`,
        entity: "taskTag",
        action: "create",
        entityId: `${ids.task}:${ids.tag}`,
        data: { taskId: ids.task, tagId: ids.tag },
      },
      {
        operationId: `op-hcat-${run}`,
        entity: "habitCategory",
        action: "create",
        entityId: ids.habitCategory,
        data: { name: `Category ${run}`, icon: "star", color: "#22C55E" },
      },
      {
        operationId: `op-habit-${run}`,
        entity: "habit",
        action: "create",
        entityId: ids.habit,
        data: { name: "Read", categoryId: ids.habitCategory, priority: 2 },
      },
      {
        operationId: `op-hlog-${run}`,
        entity: "habitLog",
        action: "create",
        entityId: ids.habitLog,
        data: { habitId: ids.habit, date: "2026-10-19", status: "completed" },
      },
    ]);

    expect(body.results).toHaveLength(8);
    for (const result of body.results) {
      expect(result.status, JSON.stringify(result)).toBe("applied");
      expect(result.version).toBeDefined();
    }
  });

  it("returns everything in a full snapshot", async () => {
    const body = await pull();
    expect(Number(body.serverRevision)).toBeGreaterThan(0);
    expect(body.resetRequired).toBe(false);

    expect(body.changes.lists.map((r) => r.id)).toContain(ids.list);
    expect(body.changes.tags.map((r) => r.id)).toContain(ids.tag);
    expect(body.changes.tasks.map((r) => r.id)).toContain(ids.task);
    expect(body.changes.checklistItems.map((r) => r.id)).toContain(ids.checklist);
    expect(body.changes.taskTags.map((r) => r.id)).toContain(`${ids.task}:${ids.tag}`);
    expect(body.changes.habits.map((r) => r.id)).toContain(ids.habit);
    expect(body.changes.habitCategories.map((r) => r.id)).toContain(ids.habitCategory);
    expect(body.changes.habitLogs.map((r) => r.id)).toContain(ids.habitLog);

    cursorAfterCreate = body.cursor;
  });

  it("does not expose sync metadata through the normal REST API", async () => {
    const lists = await app.inject({ method: "GET", url: "/api/lists", ...auth() });
    expect(lists.statusCode).toBe(200);
    expect(lists.json()[0]).not.toHaveProperty("syncVersion");
    expect(lists.json()[0]).not.toHaveProperty("deletedAt");

    const tags = await app.inject({ method: "GET", url: "/api/tags", ...auth() });
    expect(tags.statusCode).toBe(200);
    expect(tags.json()[0]).not.toHaveProperty("syncVersion");

    const habits = await app.inject({ method: "GET", url: "/api/habits", ...auth() });
    expect(habits.statusCode).toBe(200);
    const habit = habits.json().find((h: { id: string }) => h.id === ids.habit);
    expect(habit).not.toHaveProperty("syncVersion");
    expect(habit.categoryId).toBe(ids.habitCategory);
    expect(habit.habitCategory).not.toHaveProperty("syncVersion");

    const categories = await app.inject({
      method: "GET",
      url: "/api/habit-categories",
      ...auth(),
    });
    expect(categories.statusCode).toBe(200);
    expect(categories.json()[0]).not.toHaveProperty("syncVersion");

    const task = await app.inject({ method: "GET", url: `/api/tasks/${ids.task}`, ...auth() });
    expect(task.statusCode).toBe(200);
    expect(task.json()).not.toHaveProperty("syncVersion");
    expect(task.json().checklistItems[0]).not.toHaveProperty("syncVersion");
    expect(task.json().tags[0]).not.toHaveProperty("syncVersion");
  });

  it("applies an update with a matching baseVersion", async () => {
    const staleTaskVersion = (await pull()).changes.tasks.find((t) => t.id === ids.task)!
      .version as string;

    const body = await push([
      {
        operationId: `op-task-update-${run}`,
        entity: "task",
        action: "update",
        entityId: ids.task,
        baseVersion: staleTaskVersion,
        data: { title: "Updated offline", isCompleted: true },
      },
    ]);

    expect(body.results[0].status).toBe("applied");
    expect(body.results[0].data?.title).toBe("Updated offline");
    expect(Number(body.results[0].version)).toBeGreaterThan(Number(staleTaskVersion));
  });

  it("returns a conflict when baseVersion is stale and applies with force", async () => {
    const current = (await pull()).changes.tasks.find((t) => t.id === ids.task)!;
    const staleVersion = (Number(current.version) - 1).toString();

    const conflict = await push([
      {
        operationId: `op-task-stale-${run}`,
        entity: "task",
        action: "update",
        entityId: ids.task,
        baseVersion: staleVersion,
        data: { title: "Stale write" },
      },
    ]);

    expect(conflict.results[0].status).toBe("conflict");
    expect(conflict.results[0].data?.title).toBe("Updated offline");
    expect(conflict.results[0].version).toBe(current.version);

    const forced = await push([
      {
        operationId: `op-task-force-${run}`,
        entity: "task",
        action: "update",
        entityId: ids.task,
        baseVersion: staleVersion,
        force: true,
        data: { title: "Forced write" },
      },
    ]);

    expect(forced.results[0].status).toBe("applied");
    expect(forced.results[0].data?.title).toBe("Forced write");
  });

  it("returns only rows newer than the cursor", async () => {
    const body = await pull(cursorAfterCreate);
    expect(body.changes.tasks.map((t) => t.id)).toContain(ids.task);
    expect(body.changes.lists).toEqual([]);
    expect(body.changes.tags).toEqual([]);
    expect(body.changes.habits).toEqual([]);
  });

  let deleteOperationId: string;

  it("soft-deletes a task and returns tombstones for its children", async () => {
    const current = (await pull()).changes.tasks.find((t) => t.id === ids.task)!;
    deleteOperationId = `op-task-delete-${run}`;

    const body = await push([
      {
        operationId: deleteOperationId,
        entity: "task",
        action: "delete",
        entityId: ids.task,
        baseVersion: current.version as string,
      },
    ]);

    expect(body.results[0].status).toBe("applied");
    expect(body.results[0].data?.deletedAt).toBeTruthy();

    const delta = await pull(cursorAfterCreate);
    const taskTombstone = delta.changes.tasks.find((t) => t.id === ids.task);
    expect(taskTombstone?.deletedAt).toBeTruthy();
    expect(delta.changes.checklistItems.find((c) => c.id === ids.checklist)?.deletedAt).toBeTruthy();
    expect(delta.changes.taskTags.find((t) => t.id === `${ids.task}:${ids.tag}`)?.deletedAt).toBeTruthy();
  });

  it("is idempotent for a repeated operationId", async () => {
    const before = await pull();
    const repeated = await push([
      {
        operationId: deleteOperationId,
        entity: "task",
        action: "delete",
        entityId: ids.task,
      },
    ]);
    const after = await pull();

    expect(repeated.results[0].status).toBe("applied");
    expect(repeated.results[0].data?.deletedAt).toBeTruthy();
    expect(after.serverRevision).toBe(before.serverRevision);
  });

  it("hides soft-deleted rows from the normal API", async () => {
    const all = await app.inject({
      method: "GET",
      url: "/api/tasks",
      ...auth(),
    });
    expect(all.statusCode).toBe(200);
    expect(all.json().map((t: { id: string }) => t.id)).not.toContain(ids.task);

    const one = await app.inject({
      method: "GET",
      url: `/api/tasks/${ids.task}`,
      ...auth(),
    });
    expect(one.statusCode).toBe(404);
  });

  it("requests a reset when the client cursor is ahead of the server", async () => {
    const body = await pull("999999999");
    expect(body.resetRequired).toBe(true);
    expect(body.changes.tasks.map((t) => t.id)).not.toContain(ids.task);
    expect(body.changes.lists.map((r) => r.id)).toContain(ids.list);
  });

  it("returns the canonical server id when a deleted habit log is recreated", async () => {
    const deleted = await push([
      {
        operationId: `op-hlog-delete-${run}`,
        entity: "habitLog",
        action: "delete",
        entityId: ids.habitLog,
      },
    ]);
    expect(deleted.results[0].status).toBe("applied");

    const recreated = await push([
      {
        operationId: `op-hlog-recreate-${run}`,
        entity: "habitLog",
        action: "create",
        entityId: `hlog-new-${run}`,
        data: { habitId: ids.habit, date: "2026-10-19", status: "completed" },
      },
    ]);

    expect(recreated.results[0].status).toBe("applied");
    expect(recreated.results[0].entityId).toBe(ids.habitLog);
    expect(recreated.results[0].data?.id).toBe(ids.habitLog);
    expect(recreated.results[0].data?.deletedAt).toBeNull();
  });

  it("hides soft-deleted lists, tags and habits from the normal API", async () => {
    const snapshot = await pull();
    const list = snapshot.changes.lists.find((r) => r.id === ids.list)!;
    const tag = snapshot.changes.tags.find((r) => r.id === ids.tag)!;
    const habit = snapshot.changes.habits.find((r) => r.id === ids.habit)!;
    const category = snapshot.changes.habitCategories.find((r) => r.id === ids.habitCategory)!;

    const body = await push([
      {
        operationId: `op-list-delete-${run}`,
        entity: "list",
        action: "delete",
        entityId: ids.list,
        baseVersion: list.version as string,
      },
      {
        operationId: `op-tag-delete-${run}`,
        entity: "tag",
        action: "delete",
        entityId: ids.tag,
        baseVersion: tag.version as string,
      },
      {
        operationId: `op-habit-delete-${run}`,
        entity: "habit",
        action: "delete",
        entityId: ids.habit,
        baseVersion: habit.version as string,
      },
      {
        operationId: `op-hcat-delete-${run}`,
        entity: "habitCategory",
        action: "delete",
        entityId: ids.habitCategory,
        baseVersion: category.version as string,
      },
    ]);

    for (const result of body.results) {
      expect(result.status, JSON.stringify(result)).toBe("applied");
    }

    const lists = await app.inject({ method: "GET", url: "/api/lists", ...auth() });
    expect(lists.json().map((r: { id: string }) => r.id)).not.toContain(ids.list);

    const tags = await app.inject({ method: "GET", url: "/api/tags", ...auth() });
    expect(tags.json().map((r: { id: string }) => r.id)).not.toContain(ids.tag);

    const habits = await app.inject({ method: "GET", url: "/api/habits", ...auth() });
    expect(habits.json().map((r: { id: string }) => r.id)).not.toContain(ids.habit);

    const categories = await app.inject({
      method: "GET",
      url: "/api/habit-categories",
      ...auth(),
    });
    expect(categories.json().map((r: { id: string }) => r.id)).not.toContain(ids.habitCategory);
  });

  it("rejects unsupported entities", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sync/push",
      ...auth(),
      payload: {
        operations: [
          {
            operationId: `op-bad-${run}`,
            entity: "attachment",
            action: "create",
            entityId: "x",
            data: {},
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
