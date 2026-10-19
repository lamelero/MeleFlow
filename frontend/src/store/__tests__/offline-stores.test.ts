import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { destroyDB } from "../../sync/db";
import { initSync, shutdownSync } from "../../sync/engine";
import { listOperations } from "../../sync/queue";
import { selectLists, selectTags, selectTasks } from "../../sync/repository";
import { useListStore } from "../listStore";
import { useTagStore } from "../tagStore";
import { useTaskStore } from "../taskStore";

beforeEach(async () => {
  await destroyDB();
  shutdownSync();
  await initSync("user-1");
});

afterEach(async () => {
  await destroyDB();
  shutdownSync();
});

describe("offline stores — lists", () => {
  it("creates a list locally, queues the operation and returns it with an id", async () => {
    const created = await useListStore.getState().createList({ name: "Inbox", color: "#fff" });

    expect(created.id).toBeTruthy();
    expect(created._count.tasks).toBe(0);
    expect((await selectLists()).map((l) => l.name)).toEqual(["Inbox"]);

    const ops = await listOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ entity: "list", action: "create", entityId: created.id });
  });

  it("cancels the create when a locally-created list is deleted before syncing", async () => {
    const created = await useListStore.getState().createList({ name: "Temp", color: "#fff" });
    await useListStore.getState().deleteList(created.id);

    expect(await selectLists()).toHaveLength(0);
    expect(await listOperations()).toHaveLength(0);
  });

  it("coalesces consecutive updates into a single operation", async () => {
    const created = await useListStore.getState().createList({ name: "Work", color: "#fff" });
    await useListStore.getState().updateList(created.id, { name: "Work 2" });
    await useListStore.getState().updateList(created.id, { color: "#000" });

    const ops = await listOperations();
    expect(ops).toHaveLength(1);
    expect(ops[0].action).toBe("create");
    expect(ops[0].data).toMatchObject({ name: "Work 2", color: "#000" });
  });

  it("clears listId from pending task creates when the list is deleted", async () => {
    const created = await useListStore.getState().createList({ name: "Temp", color: "#fff" });
    await useTaskStore.getState().createTask({ title: "Task", listId: created.id });

    await useListStore.getState().deleteList(created.id);

    const ops = await listOperations();
    const taskOp = ops.find((o) => o.entity === "task" && o.action === "create");
    expect(taskOp?.data?.listId).toBeNull();
    expect(ops.some((o) => o.entity === "list")).toBe(false);
    expect((await selectTasks())[0].listId).toBeNull();
  });
});

describe("offline stores — tasks", () => {
  it("creates a task with checklist items offline", async () => {
    const task = await useTaskStore.getState().createTask({
      title: "Groceries",
      type: "CHECKLIST",
      checklistItems: [
        { text: "Milk", isCompleted: false, position: 0 },
        { text: "Bread", isCompleted: false, position: 1 },
      ],
    });

    expect(task.id).toBeTruthy();
    expect(task.checklistItems?.map((c) => c.text)).toEqual(["Milk", "Bread"]);

    const tasks = await selectTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].checklistItems).toHaveLength(2);

    const ops = await listOperations();
    const entityActions = ops.map((o) => `${o.entity}:${o.action}`);
    expect(entityActions).toEqual(["task:create", "checklistItem:create", "checklistItem:create"]);
  });

  it("diffs checklist items on update", async () => {
    const task = await useTaskStore.getState().createTask({
      title: "Groceries",
      type: "CHECKLIST",
      checklistItems: [
        { text: "Milk", isCompleted: false, position: 0 },
        { text: "Bread", isCompleted: false, position: 1 },
      ],
    });

    const items = (await selectTasks())[0].checklistItems ?? [];
    const updated = items
      .filter((c) => c.text !== "Milk")
      .map((c, i) => ({ ...c, position: i, isCompleted: c.text === "Bread" }));

    await useTaskStore.getState().updateTask(task.id, { checklistItems: updated });

    const after = (await selectTasks())[0].checklistItems ?? [];
    expect(after).toHaveLength(1);
    expect(after[0].text).toBe("Bread");
    expect(after[0].isCompleted).toBe(true);

    // Removing an item that was only created locally cancels its create op.
    const ops = await listOperations();
    const checklistOps = ops.filter((o) => o.entity === "checklistItem");
    expect(checklistOps).toHaveLength(1);
    expect(checklistOps[0].action).toBe("create");
    expect(checklistOps[0].data).toMatchObject({ text: "Bread", isCompleted: true });
    expect(ops.some((o) => o.action === "delete")).toBe(false);
  });

  it("adds and removes tags offline", async () => {
    const tag = await useTagStore.getState().createTag({ name: "urgent", color: "#f00" });
    const task = await useTaskStore.getState().createTask({ title: "Fix bug" });

    await useTaskStore.getState().addTag(task.id, tag.id);
    expect((await selectTasks())[0].tags?.map((t) => t.name)).toEqual(["urgent"]);
    expect((await listOperations()).filter((o) => o.entity === "taskTag")).toHaveLength(1);

    await useTaskStore.getState().removeTag(task.id, tag.id);
    expect((await selectTasks())[0].tags).toEqual([]);
    // The link was never pushed, so the queued create is simply cancelled.
    expect((await listOperations()).filter((o) => o.entity === "taskTag")).toHaveLength(0);
  });
});
