import type { Prisma, Task, List, Tag, ChecklistItem, TaskTag, Habit, HabitCategoryModel, HabitLog } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PushBody, SyncOperationInput } from "./sync.schema";
import {
  checklistItemCreateData,
  checklistItemUpdateData,
  habitCategoryCreateData,
  habitCategoryUpdateData,
  habitCreateData,
  habitLogCreateData,
  habitLogUpdateData,
  habitUpdateData,
  listCreateData,
  listUpdateData,
  tagCreateData,
  tagUpdateData,
  taskCreateData,
  taskTagCreateData,
  taskUpdateData,
} from "./sync.schema";
import { SYNC_PROTOCOL_VERSION, type SyncEntity } from "./sync.constants";

type Tx = Prisma.TransactionClient;

export type SyncOperationResult = {
  status: "applied" | "conflict" | "error";
  operationId: string;
  entity: SyncEntity;
  action: "create" | "update" | "delete";
  entityId: string;
  version?: string;
  data?: unknown;
  error?: string;
  code?: string;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function versionOf(data: unknown): string | undefined {
  return (data as { version?: string } | undefined)?.version;
}

// ── Serializers (flat payloads, relations are rehydrated client-side) ──

function serializeTask(row: Task) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    type: row.type,
    dueDate: iso(row.dueDate),
    rrule: row.rrule,
    isCompleted: row.isCompleted,
    listId: row.listId,
    parentTaskId: row.parentTaskId,
    reminderEnabled: row.reminderEnabled,
    reminderConfig: row.reminderConfig,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeList(row: List) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isSmart: row.isSmart,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeTag(row: Tag) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeChecklistItem(row: ChecklistItem) {
  return {
    id: row.id,
    taskId: row.taskId,
    text: row.text,
    isCompleted: row.isCompleted,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeTaskTag(row: TaskTag) {
  return {
    id: `${row.taskId}:${row.tagId}`,
    taskId: row.taskId,
    tagId: row.tagId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeHabit(row: Habit) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priority: row.priority,
    frequency: row.frequency,
    startDate: row.startDate.toISOString(),
    endDate: iso(row.endDate),
    isArchived: row.isArchived,
    streakCount: row.streakCount,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeHabitCategory(row: HabitCategoryModel) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

function serializeHabitLog(row: HabitLog) {
  return {
    id: row.id,
    habitId: row.habitId,
    date: day(row.date),
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: iso(row.deletedAt),
    version: row.syncVersion.toString(),
  };
}

// ── Idempotency helpers ──────────────────────────

function jsonResult(result: SyncOperationResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Operation failed";
}

// ── Service ──────────────────────────────────────

export class SyncService {
  // ── PULL ────────────────────────────────────────
  async pull(userId: string, cursorRaw?: string, deviceId?: string) {
    const requestedCursor = cursorRaw !== undefined ? BigInt(cursorRaw) : null;

    // Capture the revision BEFORE reading rows. Anything written concurrently
    // gets a higher revision and is picked up by the next pull.
    const state = await prisma.syncState.findUnique({ where: { userId } });
    const serverRevision = state?.revision ?? 0n;

    let resetRequired = false;
    if (requestedCursor !== null && requestedCursor > serverRevision) {
      resetRequired = true;
    }

    const incremental = requestedCursor !== null && !resetRequired;
    const cursor = resetRequired ? null : requestedCursor;

    const baseWhere = incremental
      ? { userId, syncVersion: { gt: cursor! } }
      : { userId, deletedAt: null };

    const [tasks, lists, tags, checklistItems, taskTags, habits, habitCategories, habitLogs] =
      await Promise.all([
        prisma.task.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.list.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.tag.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.checklistItem.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.taskTag.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.habit.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.habitCategoryModel.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
        prisma.habitLog.findMany({
          where: baseWhere,
          orderBy: { syncVersion: "asc" },
        }),
      ]);

    await this.touchDevice(userId, deviceId, serverRevision);

    return {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      serverRevision: serverRevision.toString(),
      cursor: serverRevision.toString(),
      resetRequired,
      hasMore: false,
      changes: {
        lists: lists.map(serializeList),
        tags: tags.map(serializeTag),
        tasks: tasks.map(serializeTask),
        checklistItems: checklistItems.map(serializeChecklistItem),
        taskTags: taskTags.map(serializeTaskTag),
        habits: habits.map(serializeHabit),
        habitCategories: habitCategories.map(serializeHabitCategory),
        habitLogs: habitLogs.map(serializeHabitLog),
      },
    };
  }

  // ── PUSH ────────────────────────────────────────
  async push(userId: string, body: PushBody) {
    const results: SyncOperationResult[] = [];

    for (const op of body.operations) {
      // Fast path: operation already processed in a previous request.
      const existing = await prisma.syncOperation.findUnique({
        where: { userId_operationId: { userId, operationId: op.operationId } },
      });

      if (existing) {
        results.push(existing.result as unknown as SyncOperationResult);
        continue;
      }

      results.push(await this.applyOperation(userId, op));
    }

    await this.touchDevice(userId, body.deviceId);

    return {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      results,
    };
  }

  private async applyOperation(
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const result = await this.mutate(tx, userId, op);

        await tx.syncOperation.create({
          data: {
            userId,
            operationId: op.operationId,
            entity: op.entity,
            entityId: op.entityId,
            status: result.status,
            result: jsonResult(result),
          },
        });

        return result;
      });
    } catch (err) {
      // Concurrent duplicate operationId: return the result stored by the
      // transaction that won the race.
      if (isUniqueViolation(err)) {
        const existing = await prisma.syncOperation.findUnique({
          where: { userId_operationId: { userId, operationId: op.operationId } },
        });
        if (existing) return existing.result as unknown as SyncOperationResult;
      }

      return {
        status: "error",
        operationId: op.operationId,
        entity: op.entity,
        action: op.action,
        entityId: op.entityId,
        error: errorMessage(err),
        ...(isUniqueViolation(err) ? { code: "unique_conflict" } : {}),
      };
    }
  }

  private async mutate(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    switch (op.entity) {
      case "task":
        return this.mutateTask(tx, userId, op);
      case "list":
        return this.mutateList(tx, userId, op);
      case "tag":
        return this.mutateTag(tx, userId, op);
      case "checklistItem":
        return this.mutateChecklistItem(tx, userId, op);
      case "taskTag":
        return this.mutateTaskTag(tx, userId, op);
      case "habit":
        return this.mutateHabit(tx, userId, op);
      case "habitCategory":
        return this.mutateHabitCategory(tx, userId, op);
      case "habitLog":
        return this.mutateHabitLog(tx, userId, op);
    }
  }

  // ── Entity mutations ────────────────────────────

  private async mutateTask(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = taskCreateData.parse(op.data ?? {});
      await this.assertList(tx, userId, data.listId);
      await this.assertTask(tx, userId, data.parentTaskId);

      const row = await tx.task.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeTask(row));
    }

    const current = await tx.task.findFirst({
      where: { id: op.entityId, userId },
    });

    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeTask(current))
        : this.conflict(op, serializeTask(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeTask(current));

    if (op.action === "update") {
      const data = taskUpdateData.parse(op.data ?? {});
      await this.assertList(tx, userId, data.listId);
      await this.assertTask(tx, userId, data.parentTaskId, op.entityId);

      const row = await tx.task.update({
        where: { id: op.entityId },
        data,
      });
      return this.applied(op, serializeTask(row));
    }

    // Delete: recursive soft delete of the task tree + children.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT "id" FROM "Task"
        WHERE "id" = ${op.entityId} AND "userId" = ${userId} AND "deletedAt" IS NULL
        UNION
        SELECT t."id"
        FROM "Task" t
        JOIN tree ON t."parentTaskId" = tree."id" AND t."userId" = ${userId}
      )
      SELECT "id" FROM tree
    `;
    const taskIds = rows.map((r) => r.id);
    const now = new Date();

    if (taskIds.length > 0) {
      await tx.task.updateMany({
        where: { id: { in: taskIds }, userId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.checklistItem.updateMany({
        where: { taskId: { in: taskIds }, userId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.taskTag.updateMany({
        where: { taskId: { in: taskIds }, userId, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    const row = await tx.task.findUnique({ where: { id: op.entityId } });
    return this.applied(op, row ? serializeTask(row) : undefined);
  }

  private async mutateList(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = listCreateData.parse(op.data ?? {});
      const row = await tx.list.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeList(row));
    }

    const current = await tx.list.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeList(current))
        : this.conflict(op, serializeList(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeList(current));

    if (op.action === "update") {
      const data = listUpdateData.parse(op.data ?? {});
      const row = await tx.list.update({ where: { id: op.entityId }, data });
      return this.applied(op, serializeList(row));
    }

    const now = new Date();
    await tx.task.updateMany({
      where: { userId, listId: op.entityId, deletedAt: null },
      data: { listId: null },
    });
    const row = await tx.list.update({
      where: { id: op.entityId },
      data: { deletedAt: now },
    });
    return this.applied(op, serializeList(row));
  }

  private async mutateTag(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = tagCreateData.parse(op.data ?? {});
      const row = await tx.tag.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeTag(row));
    }

    const current = await tx.tag.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeTag(current))
        : this.conflict(op, serializeTag(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeTag(current));

    if (op.action === "update") {
      const data = tagUpdateData.parse(op.data ?? {});
      const row = await tx.tag.update({ where: { id: op.entityId }, data });
      return this.applied(op, serializeTag(row));
    }

    const now = new Date();
    await tx.taskTag.updateMany({
      where: { tagId: op.entityId, deletedAt: null },
      data: { deletedAt: now },
    });
    const row = await tx.tag.update({
      where: { id: op.entityId },
      data: { deletedAt: now },
    });
    return this.applied(op, serializeTag(row));
  }

  private async mutateChecklistItem(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = checklistItemCreateData.parse(op.data ?? {});
      await this.assertTask(tx, userId, data.taskId);

      const row = await tx.checklistItem.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeChecklistItem(row));
    }

    const current = await tx.checklistItem.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeChecklistItem(current))
        : this.conflict(op, serializeChecklistItem(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeChecklistItem(current));

    if (op.action === "update") {
      const data = checklistItemUpdateData.parse(op.data ?? {});
      const row = await tx.checklistItem.update({
        where: { id: op.entityId },
        data,
      });
      return this.applied(op, serializeChecklistItem(row));
    }

    const row = await tx.checklistItem.update({
      where: { id: op.entityId },
      data: { deletedAt: new Date() },
    });
    return this.applied(op, serializeChecklistItem(row));
  }

  private async mutateTaskTag(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    const { taskId, tagId } = this.parseTaskTagId(op);

    if (op.action === "create") {
      const payload = taskTagCreateData.parse(op.data ?? { taskId, tagId });
      if (payload.taskId !== taskId || payload.tagId !== tagId) {
        throw new Error("taskTag entityId must match data.taskId:data.tagId");
      }

      await this.assertTask(tx, userId, taskId);
      await this.assertTag(tx, userId, tagId);

      const row = await tx.taskTag.upsert({
        where: { taskId_tagId: { taskId, tagId } },
        create: { taskId, tagId, userId },
        update: { deletedAt: null },
      });
      return this.applied(op, serializeTaskTag(row), `${taskId}:${tagId}`);
    }

    if (op.action === "update") {
      return {
        ...this.notFound(op),
        code: "unsupported_action",
        error: "taskTag does not support update; use create or delete",
      };
    }

    const current = await tx.taskTag.findUnique({
      where: { taskId_tagId: { taskId, tagId } },
    });
    if (!current || current.userId !== userId) {
      return this.applied(op, undefined, `${taskId}:${tagId}`);
    }
    if (current.deletedAt) {
      return this.applied(op, serializeTaskTag(current), `${taskId}:${tagId}`);
    }
    if (this.isStale(current, op)) {
      return this.conflict(op, serializeTaskTag(current), undefined, `${taskId}:${tagId}`);
    }

    const row = await tx.taskTag.update({
      where: { taskId_tagId: { taskId, tagId } },
      data: { deletedAt: new Date() },
    });
    return this.applied(op, serializeTaskTag(row), `${taskId}:${tagId}`);
  }

  private async mutateHabit(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = habitCreateData.parse(op.data ?? {});
      await this.assertHabitCategory(tx, userId, data.categoryId);

      const row = await tx.habit.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeHabit(row));
    }

    const current = await tx.habit.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeHabit(current))
        : this.conflict(op, serializeHabit(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeHabit(current));

    if (op.action === "update") {
      const data = habitUpdateData.parse(op.data ?? {});
      await this.assertHabitCategory(tx, userId, data.categoryId);

      const row = await tx.habit.update({ where: { id: op.entityId }, data });
      return this.applied(op, serializeHabit(row));
    }

    const now = new Date();
    await tx.habitLog.updateMany({
      where: { habitId: op.entityId, deletedAt: null },
      data: { deletedAt: now },
    });
    const row = await tx.habit.update({
      where: { id: op.entityId },
      data: { deletedAt: now },
    });
    return this.applied(op, serializeHabit(row));
  }

  private async mutateHabitCategory(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = habitCategoryCreateData.parse(op.data ?? {});
      const row = await tx.habitCategoryModel.create({
        data: { id: op.entityId, userId, ...data },
      });
      return this.applied(op, serializeHabitCategory(row));
    }

    const current = await tx.habitCategoryModel.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeHabitCategory(current))
        : this.conflict(op, serializeHabitCategory(current), "deleted");
    }
    if (this.isStale(current, op)) {
      return this.conflict(op, serializeHabitCategory(current));
    }

    if (op.action === "update") {
      const data = habitCategoryUpdateData.parse(op.data ?? {});
      const row = await tx.habitCategoryModel.update({
        where: { id: op.entityId },
        data,
      });
      return this.applied(op, serializeHabitCategory(row));
    }

    const now = new Date();
    await tx.habit.updateMany({
      where: { userId, categoryId: op.entityId, deletedAt: null },
      data: { categoryId: null },
    });
    const row = await tx.habitCategoryModel.update({
      where: { id: op.entityId },
      data: { deletedAt: now },
    });
    return this.applied(op, serializeHabitCategory(row));
  }

  private async mutateHabitLog(
    tx: Tx,
    userId: string,
    op: SyncOperationInput,
  ): Promise<SyncOperationResult> {
    if (op.action === "create") {
      const data = habitLogCreateData.parse(op.data ?? {});
      await this.assertHabit(tx, userId, data.habitId);

      const date = normalizeDate(data.date);

      // A client may generate a fresh id for a (habitId, date) that already
      // exists (e.g. it was deleted on another device). Return the canonical
      // server row instead of violating the unique constraint.
      const existing = await tx.habitLog.findUnique({
        where: { habitId_date: { habitId: data.habitId, date } },
      });

      if (existing) {
        if (!existing.deletedAt) {
          return this.conflict(op, serializeHabitLog(existing), undefined, existing.id);
        }
        const revived = await tx.habitLog.update({
          where: { id: existing.id },
          data: { ...data, date, deletedAt: null },
        });
        return this.applied(op, serializeHabitLog(revived), existing.id);
      }

      const row = await tx.habitLog.create({
        data: { id: op.entityId, userId, ...data, date },
      });
      return this.applied(op, serializeHabitLog(row));
    }

    const current = await tx.habitLog.findFirst({
      where: { id: op.entityId, userId },
    });
    if (!current) return this.missing(op);
    if (current.deletedAt) {
      return op.action === "delete"
        ? this.applied(op, serializeHabitLog(current))
        : this.conflict(op, serializeHabitLog(current), "deleted");
    }
    if (this.isStale(current, op)) return this.conflict(op, serializeHabitLog(current));

    if (op.action === "update") {
      const data = habitLogUpdateData.parse(op.data ?? {});
      const row = await tx.habitLog.update({
        where: { id: op.entityId },
        data: {
          ...data,
          ...(data.date ? { date: normalizeDate(data.date) } : {}),
        },
      });
      return this.applied(op, serializeHabitLog(row));
    }

    const row = await tx.habitLog.update({
      where: { id: op.entityId },
      data: { deletedAt: new Date() },
    });
    return this.applied(op, serializeHabitLog(row));
  }

  // ── Helpers ─────────────────────────────────────

  private isStale(current: { syncVersion: bigint }, op: SyncOperationInput): boolean {
    if (op.force) return false;
    if (!op.baseVersion) return false;
    return current.syncVersion > BigInt(op.baseVersion);
  }

  private applied(
    op: SyncOperationInput,
    data?: unknown,
    entityId = op.entityId,
  ): SyncOperationResult {
    return {
      status: "applied",
      operationId: op.operationId,
      entity: op.entity,
      action: op.action,
      entityId,
      version: versionOf(data),
      data,
    };
  }

  private conflict(
    op: SyncOperationInput,
    data: unknown,
    error?: string,
    entityId = op.entityId,
  ): SyncOperationResult {
    return {
      status: "conflict",
      operationId: op.operationId,
      entity: op.entity,
      action: op.action,
      entityId,
      version: versionOf(data),
      data,
      ...(error ? { error } : {}),
    };
  }

  private notFound(op: SyncOperationInput): SyncOperationResult {
    return {
      status: "error",
      operationId: op.operationId,
      entity: op.entity,
      action: op.action,
      entityId: op.entityId,
      code: "not_found",
      error: `${op.entity} not found`,
    };
  }

  private missing(op: SyncOperationInput): SyncOperationResult {
    // Deleting something that is already gone is idempotent.
    return op.action === "delete" ? this.applied(op) : this.notFound(op);
  }

  private parseTaskTagId(op: SyncOperationInput): { taskId: string; tagId: string } {
    const [taskId, tagId] = op.entityId.split(":");
    if (!taskId || !tagId) {
      throw new Error("taskTag entityId must be \"<taskId>:<tagId>\"");
    }
    return { taskId, tagId };
  }

  private async assertTask(
    tx: Tx,
    userId: string,
    taskId: string | null | undefined,
    excludeId?: string,
  ): Promise<void> {
    if (!taskId) return;
    if (excludeId && taskId === excludeId) {
      throw new Error("A task cannot be its own parent");
    }
    const task = await tx.task.findFirst({
      where: { id: taskId, userId, deletedAt: null },
    });
    if (!task) throw new Error(`Parent task ${taskId} not found`);
  }

  private async assertList(
    tx: Tx,
    userId: string,
    listId: string | null | undefined,
  ): Promise<void> {
    if (!listId) return;
    const list = await tx.list.findFirst({
      where: { id: listId, userId, deletedAt: null },
    });
    if (!list) throw new Error(`List ${listId} not found`);
  }

  private async assertTag(tx: Tx, userId: string, tagId: string): Promise<void> {
    const tag = await tx.tag.findFirst({
      where: { id: tagId, userId, deletedAt: null },
    });
    if (!tag) throw new Error(`Tag ${tagId} not found`);
  }

  private async assertHabit(tx: Tx, userId: string, habitId: string): Promise<void> {
    const habit = await tx.habit.findFirst({
      where: { id: habitId, userId, deletedAt: null },
    });
    if (!habit) throw new Error(`Habit ${habitId} not found`);
  }

  private async assertHabitCategory(
    tx: Tx,
    userId: string,
    categoryId: string | null | undefined,
  ): Promise<void> {
    if (!categoryId) return;
    const category = await tx.habitCategoryModel.findFirst({
      where: { id: categoryId, userId, deletedAt: null },
    });
    if (!category) throw new Error(`Habit category ${categoryId} not found`);
  }

  private async touchDevice(
    userId: string,
    deviceId?: string,
    cursor?: bigint,
  ): Promise<void> {
    if (!deviceId) return;

    try {
      await prisma.syncDevice.upsert({
        where: { userId_deviceId: { userId, deviceId } },
        create: {
          userId,
          deviceId,
          lastCursor: cursor ?? 0n,
        },
        update: {
          lastSeenAt: new Date(),
          ...(cursor !== undefined ? { lastCursor: cursor } : {}),
        },
      });
    } catch (err) {
      // Device metadata is diagnostic only; never fail a sync because of it.
      console.error("[Sync] failed to update device metadata:", err);
    }
  }
}
