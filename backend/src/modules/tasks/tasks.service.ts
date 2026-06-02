import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateTaskInput, UpdateTaskInput, TaskQuery } from "./tasks.schema";

const subTaskOrder = [{ priority: "asc" as const }, { createdAt: "desc" as const }];

const taskInclude = {
  subTasks: {
    orderBy: subTaskOrder,
    include: { tags: { include: { tag: true } } },
  },
  tags: { include: { tag: true } },
  attachments: { orderBy: { uploadDate: "desc" as const } },
  checklistItems: { orderBy: { position: "asc" as const } },
};

const taskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  type: true,
  isCompleted: true,
  dueDate: true,
  rrule: true,
  listId: true,
  parentTaskId: true,
  createdAt: true,
  updatedAt: true,
  reminderEnabled: true,
  reminderConfig: true,
} as const;

type RawTask = Record<string, unknown>;
type RawTaskTag = { tag: { id: string; name: string; color: string } };
type RawAttachment = { id: string; fileName: string; fileUrl: string; fileSize: bigint; uploadDate: string };
type RawChecklistItem = { id: string; text: string; isCompleted: boolean; position: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTask(task: RawTask): any {
  const { tags, subTasks, attachments, checklistItems, ...rest } = task;
  return {
    ...rest,
    type: rest.type || "TEXT",
    tags: (tags as RawTaskTag[] | undefined)?.map((t) => t.tag) ?? [],
    subTasks: (subTasks as RawTask[] | undefined)?.map(formatTask) ?? [],
    attachments: (attachments as RawAttachment[] | undefined) ?? [],
    checklistItems: (checklistItems as RawChecklistItem[] | undefined) ?? [],
  };
}

export class TaskService {
  async findAll(userId: string, query: TaskQuery) {
    const where: Record<string, unknown> = {
      userId,
      parentTaskId: null,
    };

    if (query.listId) where.listId = query.listId;
    if (query.status === "completed") where.isCompleted = true;
    if (query.status === "pending") where.isCompleted = false;
    if (query.priority) where.priority = query.priority;
    if (query.tagId) {
      where.tags = { some: { tagId: query.tagId } };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return tasks.map(formatTask);
  }

  async findById(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      include: taskInclude,
    });

    if (!task) {
      throw new AppError(404, "Task not found");
    }

    return formatTask(task);
  }

  async create(userId: string, input: CreateTaskInput) {
    if (input.parentTaskId) {
      const parent = await prisma.task.findFirst({
        where: { id: input.parentTaskId, userId },
      });
      if (!parent) {
        throw new AppError(404, "Parent task not found");
      }
    }

    if (input.listId) {
      const list = await prisma.list.findFirst({
        where: { id: input.listId, userId },
      });
      if (!list) {
        throw new AppError(404, "List not found");
      }
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 4,
        type: input.type ?? "TEXT",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        rrule: input.rrule ?? null,
        listId: input.listId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        reminderEnabled: input.reminderEnabled ?? false,
        reminderConfig: input.reminderConfig ?? null,
        ...(input.checklistItems && {
          checklistItems: {
            create: input.checklistItems.map((item, i) => ({
              text: item.text,
              isCompleted: item.isCompleted,
              position: item.position ?? i,
            })),
          },
        }),
      },
      select: taskSelect,
    });

    return { ...task, tags: [], subTasks: [], checklistItems: input.checklistItems ?? [], attachments: [] };
  }

  async update(userId: string, taskId: string, input: UpdateTaskInput) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      throw new AppError(404, "Task not found");
    }

    if (input.parentTaskId) {
      if (input.parentTaskId === taskId) {
        throw new AppError(400, "A task cannot be its own parent");
      }
      const parent = await prisma.task.findFirst({
        where: { id: input.parentTaskId, userId },
      });
      if (!parent) {
        throw new AppError(404, "Parent task not found");
      }
    }

    if (input.listId) {
      const list = await prisma.list.findFirst({
        where: { id: input.listId, userId },
      });
      if (!list) {
        throw new AppError(404, "List not found");
      }
    }

    const data: Record<string, unknown> = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.isCompleted !== undefined && { isCompleted: input.isCompleted }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
      ...(input.rrule !== undefined && { rrule: input.rrule }),
      ...(input.listId !== undefined && { listId: input.listId }),
      ...(input.parentTaskId !== undefined && {
        parentTaskId: input.parentTaskId,
      }),
      ...(input.reminderEnabled !== undefined && { reminderEnabled: input.reminderEnabled }),
      ...(input.reminderConfig !== undefined && { reminderConfig: input.reminderConfig }),
    };

    if (input.checklistItems !== undefined) {
      const existing = await prisma.checklistItem.findMany({
        where: { taskId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((c) => c.id));
      const incomingIds = new Set(
        input.checklistItems.filter((c) => c.id).map((c) => c.id!),
      );

      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await prisma.checklistItem.deleteMany({
          where: { id: { in: toDelete }, taskId },
        });
      }

      for (const item of input.checklistItems) {
        if (item.id && existingIds.has(item.id)) {
          await prisma.checklistItem.update({
            where: { id: item.id },
            data: {
              text: item.text,
              isCompleted: item.isCompleted,
              position: item.position,
            },
          });
        } else {
          await prisma.checklistItem.create({
            data: {
              taskId,
              text: item.text,
              isCompleted: item.isCompleted,
              position: item.position,
            },
          });
        }
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      include: taskInclude,
      data,
    });

    return formatTask(task);
  }

  async delete(userId: string, taskId: string) {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existing) {
      throw new AppError(404, "Task not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { parentTaskId: taskId } });
      await tx.task.delete({ where: { id: taskId } });
    });
  }

  async addTag(userId: string, taskId: string, tagId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) throw new AppError(404, "Task not found");

    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!tag) throw new AppError(404, "Tag not found");

    await prisma.taskTag.upsert({
      where: { taskId_tagId: { taskId, tagId } },
      create: { taskId, tagId },
      update: {},
    });

    return this.findById(userId, taskId);
  }

  async removeTag(userId: string, taskId: string, tagId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) throw new AppError(404, "Task not found");

    await prisma.taskTag.deleteMany({
      where: { taskId, tagId },
    });

    return this.findById(userId, taskId);
  }
}
