import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { destroyDB } from "../db";
import {
  getCursor,
  initSync,
  onSyncEvent,
  pull,
  push,
  resetLocalSync,
  setSyncTransport,
  shutdownSync,
  sync,
  type SyncEvent,
  type SyncTransport,
} from "../engine";
import { countOperations, enqueue } from "../queue";
import { applyPull, getAllRows, selectTasks } from "../repository";
import type { PullChanges, PullResponse, PushResponse, TaskRow } from "../types";

const BASE = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null as string | null,
  version: "1",
};

function serverTask(id: string, extra: Partial<TaskRow> = {}): TaskRow {
  return {
    ...BASE,
    id,
    title: id,
    description: null,
    priority: 2,
    status: "todo",
    type: "TEXT",
    dueDate: null,
    rrule: null,
    isCompleted: false,
    listId: null,
    parentTaskId: null,
    reminderEnabled: false,
    reminderConfig: null,
    ...extra,
  };
}

function emptyChanges(partial: Partial<PullChanges> = {}): PullChanges {
  return {
    lists: [],
    tags: [],
    tasks: [],
    checklistItems: [],
    taskTags: [],
    habits: [],
    habitCategories: [],
    habitLogs: [],
    ...partial,
  };
}

function pullResponse(partial: Partial<PullResponse> = {}): PullResponse {
  return {
    protocolVersion: 1,
    serverRevision: "1",
    cursor: "1",
    resetRequired: false,
    hasMore: false,
    changes: emptyChanges(),
    ...partial,
  };
}

function autoAppliedPush(): SyncTransport["push"] {
  return async ({ operations }) => ({
    protocolVersion: 1,
    results: operations.map((op) => ({
      status: "applied" as const,
      operationId: op.operationId,
      entity: op.entity,
      action: op.action,
      entityId: op.entityId,
      version: "9",
      data: { ...BASE, version: "9", ...(op.data ?? {}), id: op.entityId },
    })),
  });
}

beforeEach(async () => {
  await destroyDB();
  shutdownSync();
});

afterEach(async () => {
  await destroyDB();
  shutdownSync();
});

describe("engine — pull", () => {
  it("performs a full pull first, then incremental with the stored cursor", async () => {
    const transport: SyncTransport = {
      pull: vi.fn(async () => pullResponse({ cursor: "5", changes: emptyChanges({ tasks: [serverTask("t1")] }) })),
      push: vi.fn(async () => ({ protocolVersion: 1, results: [] }) as PushResponse),
    };
    setSyncTransport(transport);
    await initSync("u1");

    await pull();
    expect(transport.pull).toHaveBeenCalledTimes(1);
    expect((transport.pull as ReturnType<typeof vi.fn>).mock.calls[0][0]).not.toHaveProperty("cursor");
    expect(await getCursor()).toBe("5");
    expect((await selectTasks()).map((t) => t.id)).toEqual(["t1"]);

    await pull();
    const secondArgs = (transport.pull as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondArgs.cursor).toBe("5");
  });

  it("rebuilds local data when the server requires a reset", async () => {
    const transport: SyncTransport = {
      pull: vi
        .fn()
        .mockResolvedValueOnce(pullResponse({ cursor: "5", changes: emptyChanges({ tasks: [serverTask("old")] }) }))
        .mockResolvedValueOnce(
          pullResponse({
            cursor: "9",
            resetRequired: true,
            changes: emptyChanges({ tasks: [serverTask("fresh")] }),
          }),
        ),
      push: vi.fn(async () => ({ protocolVersion: 1, results: [] }) as PushResponse),
    };
    setSyncTransport(transport);
    await initSync("u1");

    await pull();
    expect((await selectTasks()).map((t) => t.id)).toEqual(["old"]);

    await pull();
    expect((await selectTasks()).map((t) => t.id)).toEqual(["fresh"]);
    expect(await getCursor()).toBe("9");
  });

  it("forces a full pull when a different user logs in", async () => {
    const transport: SyncTransport = {
      pull: vi.fn(async () => pullResponse({ cursor: "5", changes: emptyChanges({ tasks: [serverTask("t1")] }) })),
      push: vi.fn(async () => ({ protocolVersion: 1, results: [] }) as PushResponse),
    };
    setSyncTransport(transport);
    await initSync("u1");
    await pull();
    expect(await getCursor()).toBe("5");

    await initSync("u2");
    expect(await getCursor()).toBeUndefined();
    await pull();

    const lastArgs = (transport.pull as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(lastArgs).not.toHaveProperty("cursor");
    expect((await selectTasks()).map((t) => t.id)).toEqual(["t1"]);
  });

  it("waits for an in-flight sync before wiping local data", async () => {
    const state: { resolvePull: ((value: PullResponse) => void) | null } = { resolvePull: null };
    setSyncTransport({
      pull: () =>
        new Promise<PullResponse>((resolve) => {
          state.resolvePull = resolve;
        }),
      push: vi.fn(async () => ({ protocolVersion: 1, results: [] })),
    });
    await initSync("u1");

    const running = sync();
    while (!state.resolvePull) await new Promise((r) => setTimeout(r, 1));

    let resetDone = false;
    const resetting = resetLocalSync().then(() => {
      resetDone = true;
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(resetDone).toBe(false);

    state.resolvePull(pullResponse({ changes: emptyChanges({ tasks: [serverTask("t1")] }) }));
    await running;
    await resetting;

    expect(await selectTasks()).toHaveLength(0);
  });

  it("clears local rows and outbox on resetLocalSync", async () => {
    const transport: SyncTransport = {
      pull: vi.fn(async () => pullResponse({ cursor: "5", changes: emptyChanges({ tasks: [serverTask("t1")] }) })),
      push: vi.fn(async () => ({ protocolVersion: 1, results: [] }) as PushResponse),
    };
    setSyncTransport(transport);
    await initSync("u1");
    await pull();
    await enqueue({ entity: "task", action: "update", entityId: "t1", data: { title: "x" } });

    await resetLocalSync();

    expect(await selectTasks()).toHaveLength(0);
    expect(await countOperations()).toBe(0);
    expect(await getCursor()).toBeUndefined();
  });
});

describe("engine — push", () => {
  async function init() {
    setSyncTransport({
      pull: vi.fn(async () => pullResponse()),
      push: vi.fn(autoAppliedPush()),
    });
    await initSync("u1");
  }

  it("removes applied operations and stores the canonical server row", async () => {
    await init();
    await enqueue({ entity: "task", action: "create", entityId: "local-1", data: { title: "Buy milk" } });

    const result = await push();

    expect(result.applied).toBe(1);
    expect(await countOperations()).toBe(0);
    const rows = await getAllRows<TaskRow>("tasks");
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe("9");
  });

  it("revives the canonical id when the server returns a different entityId", async () => {
    setSyncTransport({
      pull: vi.fn(async () => pullResponse()),
      push: vi.fn(async ({ operations }) => ({
        protocolVersion: 1,
        results: [
          {
            status: "applied" as const,
            operationId: operations[0].operationId,
            entity: operations[0].entity,
            action: operations[0].action,
            entityId: "canonical-id",
            version: "4",
            data: { ...BASE, version: "4", id: "canonical-id", habitId: "h1", date: "2026-01-01", status: "completed", note: null },
          },
        ],
      })),
    });
    await initSync("u1");
    await enqueue({ entity: "habitLog", action: "create", entityId: "local-log", data: {} });

    await push();

    const rows = await getAllRows<{ id: string }>("habitLogs");
    expect(rows.map((r) => r.id)).toEqual(["canonical-id"]);
  });

  it("keeps the server version and notifies on conflict", async () => {
    setSyncTransport({
      pull: vi.fn(async () => pullResponse()),
      push: vi.fn(async ({ operations }) => ({
        protocolVersion: 1,
        results: [
          {
            status: "conflict" as const,
            operationId: operations[0].operationId,
            entity: operations[0].entity,
            action: operations[0].action,
            entityId: "t1",
            version: "12",
            data: serverTask("t1", { title: "server title", version: "12" }),
          },
        ],
      })),
    });
    await initSync("u1");

    const events: SyncEvent[] = [];
    onSyncEvent((e) => events.push(e));

    await applyPull(emptyChanges({ tasks: [serverTask("t1", { title: "old", version: "2" })] }), true);
    await enqueue({ entity: "task", action: "update", entityId: "t1", baseVersion: "2", data: { title: "local" } });

    const result = await push();

    expect(result.conflicts).toBe(1);
    expect(await countOperations()).toBe(0);
    const rows = await getAllRows<TaskRow>("tasks");
    expect(rows[0].title).toBe("server title");
    expect(rows[0].version).toBe("12");
    expect(events.some((e) => e.type === "conflict")).toBe(true);
  });

  it("drops an optimistic create rejected as a unique conflict", async () => {
    setSyncTransport({
      pull: vi.fn(async () => pullResponse()),
      push: vi.fn(async ({ operations }) => ({
        protocolVersion: 1,
        results: [
          {
            status: "error" as const,
            operationId: operations[0].operationId,
            entity: operations[0].entity,
            action: operations[0].action,
            entityId: "local-1",
            code: "unique_conflict",
            error: "name already exists",
          },
        ],
      })),
    });
    await initSync("u1");
    await applyPull(emptyChanges(), true);
    await enqueue({ entity: "list", action: "create", entityId: "local-1", data: { name: "Work" } });

    await push();

    expect(await countOperations()).toBe(0);
    expect(await getAllRows("lists")).toHaveLength(0);
  });

  it("keeps retryable errors with the same operationId", async () => {
    const sentIds: string[] = [];
    setSyncTransport({
      pull: vi.fn(async () => pullResponse()),
      push: vi.fn(async ({ operations }) => {
        sentIds.push(operations[0].operationId);
        return {
          protocolVersion: 1,
          results: [
            {
              status: "error" as const,
              operationId: operations[0].operationId,
              entity: operations[0].entity,
              action: operations[0].action,
              entityId: operations[0].entityId,
              error: "temporary failure",
            },
          ],
        };
      }),
    });
    await initSync("u1");
    await enqueue({ entity: "task", action: "update", entityId: "t1", data: { title: "x" } });

    await push();
    expect(await countOperations()).toBe(1);

    await push();
    expect(await countOperations()).toBe(1);
    expect(sentIds[0]).toBe(sentIds[1]);
  });
});

describe("engine — sync", () => {
  it("pushes local changes before pulling", async () => {
    const order: string[] = [];
    setSyncTransport({
      pull: vi.fn(async () => {
        order.push("pull");
        return pullResponse();
      }),
      push: vi.fn(async () => {
        order.push("push");
        return { protocolVersion: 1, results: [] };
      }),
    });
    await initSync("u1");
    await enqueue({ entity: "task", action: "update", entityId: "t1", data: { title: "x" } });

    await sync();

    expect(order).toEqual(["push", "pull"]);
  });

  it("shares a single in-flight run", async () => {
    const state: { resolvePull: ((value: PullResponse) => void) | null } = { resolvePull: null };
    const pullFn = vi.fn(
      () =>
        new Promise<PullResponse>((resolve) => {
          state.resolvePull = resolve;
        }),
    );
    const pushFn = vi.fn(async () => ({ protocolVersion: 1, results: [] }));
    setSyncTransport({ pull: pullFn, push: pushFn });
    await initSync("u1");

    const first = sync();
    const second = sync();
    while (!state.resolvePull) await new Promise((r) => setTimeout(r, 1));
    state.resolvePull(pullResponse());
    await Promise.all([first, second]);

    expect(pullFn).toHaveBeenCalledTimes(1);
  });
});
