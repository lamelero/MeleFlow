import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { destroyDB } from "../db";
import { shutdownSync } from "../engine";
import {
  applyPull,
  selectCategories,
  selectHabit,
  selectHabits,
  selectLists,
  selectTags,
  selectTask,
  selectTasks,
  setCurrentUserId,
} from "../repository";
import type {
  ChecklistItemRow,
  HabitCategoryRow,
  HabitLogRow,
  HabitRow,
  ListRow,
  PullChanges,
  TagRow,
  TaskRow,
  TaskTagRow,
} from "../types";

const BASE = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null as string | null,
  version: "1",
};

function task(id: string, extra: Partial<TaskRow> = {}): TaskRow {
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

function list(id: string, extra: Partial<ListRow> = {}): ListRow {
  return { ...BASE, id, name: id, color: "#fff", icon: null, isSmart: false, ...extra };
}

function tag(id: string, extra: Partial<TagRow> = {}): TagRow {
  return { ...BASE, id, name: id, color: "#000", ...extra };
}

function checklist(id: string, taskId: string, position: number, extra: Partial<ChecklistItemRow> = {}): ChecklistItemRow {
  return { ...BASE, id, taskId, text: id, isCompleted: false, position, ...extra };
}

function taskTag(taskId: string, tagId: string, extra: Partial<TaskTagRow> = {}): TaskTagRow {
  return { ...BASE, id: `${taskId}:${tagId}`, taskId, tagId, ...extra };
}

function habit(id: string, extra: Partial<HabitRow> = {}): HabitRow {
  return {
    ...BASE,
    id,
    name: id,
    description: null,
    category: "OTROS",
    priority: 1,
    frequency: null,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    isArchived: false,
    streakCount: 0,
    categoryId: null,
    ...extra,
  };
}

function category(id: string, extra: Partial<HabitCategoryRow> = {}): HabitCategoryRow {
  return { ...BASE, id, name: id, icon: "star", color: "#111", order: 0, ...extra };
}

function habitLog(id: string, habitId: string, date: string, status = "completed", extra: Partial<HabitLogRow> = {}): HabitLogRow {
  return { ...BASE, id, habitId, date, status, note: null, ...extra };
}

function changes(partial: Partial<PullChanges> = {}): PullChanges {
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

beforeEach(async () => {
  await destroyDB();
  shutdownSync();
  setCurrentUserId("user-1");
});

afterEach(async () => {
  await destroyDB();
  shutdownSync();
});

describe("repository — pull application", () => {
  it("stores a full snapshot and rehydrates nested task data", async () => {
    await applyPull(
      changes({
        lists: [list("l1")],
        tags: [tag("tag1")],
        tasks: [
          task("t1", { listId: "l1", priority: 1 }),
          task("t2", { parentTaskId: "t1", priority: 3 }),
        ],
        checklistItems: [checklist("c-late", "t1", 1), checklist("c-early", "t1", 0)],
        taskTags: [taskTag("t1", "tag1")],
      }),
      true,
    );

    const tasks = await selectTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("t1");
    expect(tasks[0].tags).toEqual([{ id: "tag1", name: "tag1", color: "#000" }]);
    expect(tasks[0].checklistItems?.map((c) => c.id)).toEqual(["c-early", "c-late"]);
    expect(tasks[0].subTasks?.map((t) => t.id)).toEqual(["t2"]);
    expect(tasks[0].attachments).toEqual([]);
  });

  it("computes _count fields locally", async () => {
    await applyPull(
      changes({
        lists: [list("l1")],
        tags: [tag("tag1")],
        tasks: [
          task("t1", { listId: "l1" }),
          task("t2", { listId: "l1", isCompleted: true }),
          task("t3", { listId: "l1" }),
        ],
        taskTags: [taskTag("t1", "tag1"), taskTag("t3", "tag1")],
        habitCategories: [category("cat1")],
        habits: [habit("h1", { categoryId: "cat1" })],
      }),
      true,
    );

    expect((await selectLists())[0]._count.tasks).toBe(2);
    expect((await selectTags())[0]._count?.tasks).toBe(2);
    expect((await selectCategories())[0]._count?.habits).toBe(1);
  });

  it("removes tombstones on incremental pull", async () => {
    await applyPull(
      changes({
        tags: [tag("tag1")],
        tasks: [task("t1"), task("t2", { parentTaskId: "t1" })],
        taskTags: [taskTag("t1", "tag1")],
      }),
      true,
    );

    await applyPull(
      changes({
        tasks: [
          task("t1", { deletedAt: "2026-02-01T00:00:00.000Z" }),
          task("t2", { parentTaskId: "t1", deletedAt: "2026-02-01T00:00:00.000Z" }),
        ],
        taskTags: [taskTag("t1", "tag1", { deletedAt: "2026-02-01T00:00:00.000Z" })],
      }),
      false,
    );

    expect(await selectTasks()).toHaveLength(0);
    expect(await selectTask("t2")).toBeNull();
    expect((await selectTags())[0]._count?.tasks).toBe(0);
  });

  it("clears stale rows when a full snapshot is applied", async () => {
    await applyPull(changes({ tags: [tag("old")] }), true);
    await applyPull(changes({ tags: [tag("new")] }), true);

    const tags = await selectTags();
    expect(tags.map((t) => t.id)).toEqual(["new"]);
  });

  it("filters tasks locally like the REST endpoint", async () => {
    await applyPull(
      changes({
        tags: [tag("tag1")],
        tasks: [
          task("a", { priority: 1, dueDate: "2026-03-10T00:00:00.000Z" }),
          task("b", { priority: 4, isCompleted: true }),
          task("c", { priority: 2, dueDate: "2026-03-20T00:00:00.000Z" }),
        ],
        taskTags: [taskTag("c", "tag1")],
      }),
      true,
    );

    expect((await selectTasks({ priority: 1 })).map((t) => t.id)).toEqual(["a"]);
    expect((await selectTasks({ status: "completed" })).map((t) => t.id)).toEqual(["b"]);
    expect((await selectTasks({ status: "pending" })).map((t) => t.id)).toEqual(["a", "c"]);
    expect((await selectTasks({ tagId: "tag1" })).map((t) => t.id)).toEqual(["c"]);
    expect(
      (await selectTasks({ dueDateFrom: "2026-03-01", dueDateTo: "2026-03-15" })).map((t) => t.id),
    ).toEqual(["a"]);
  });
});

describe("repository — habits", () => {
  it("derives logs, streak, totalDays and completedToday from local habit logs", async () => {
    const today = daysAgo(0);
    const yesterday = daysAgo(1);

    await applyPull(
      changes({
        habitCategories: [category("cat1")],
        habits: [habit("h1", { categoryId: "cat1", priority: 3 })],
        habitLogs: [
          habitLog("log-today", "h1", today, "completed"),
          habitLog("log-yesterday", "h1", yesterday, "completed"),
          habitLog("log-old", "h1", "2026-01-01", "failed"),
        ],
      }),
      true,
    );

    const habits = await selectHabits();
    expect(habits).toHaveLength(1);
    expect(habits[0].streakCount).toBe(2);
    expect(habits[0].totalDays).toBe(2);
    expect(habits[0].completedToday).toBe(true);
    expect(habits[0].logs[0].date).toBe(today);
    expect(habits[0].habitCategory).toEqual({
      id: "cat1",
      name: "cat1",
      icon: "star",
      color: "#111",
    });

    const detail = await selectHabit("h1");
    expect(detail?.logs).toHaveLength(3);
  });

  it("excludes archived habits unless requested", async () => {
    await applyPull(
      changes({
        habits: [habit("active"), habit("archived", { isArchived: true, priority: 9 })],
      }),
      true,
    );

    expect((await selectHabits()).map((h) => h.id)).toEqual(["active"]);
    expect((await selectHabits(true)).map((h) => h.id)).toEqual(["archived", "active"]);
  });

  it("counts all logs for totals while only sending 90 days to the UI", async () => {
    await applyPull(
      changes({
        habits: [habit("h1")],
        habitLogs: [
          habitLog("recent", "h1", daysAgo(0), "completed"),
          habitLog("old", "h1", daysAgo(120), "completed"),
        ],
      }),
      true,
    );

    const list = (await selectHabits())[0];
    expect(list.totalDays).toBe(2);
    expect(list.logs).toHaveLength(1);

    const detail = await selectHabit("h1");
    expect(detail?.totalDays).toBe(2);
    expect(detail?.logs).toHaveLength(2);
  });
});
