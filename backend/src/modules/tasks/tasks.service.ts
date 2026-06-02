import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import { sendEmail } from "../../lib/email-service";
import { t } from "../../lib/email-i18n";
import type { CreateTaskInput, UpdateTaskInput, TaskQuery, AddCollaboratorInput } from "./tasks.schema";

const subTaskOrder = [{ priority: "asc" as const }, { createdAt: "desc" as const }];

const taskInclude = {
  subTasks: {
    orderBy: subTaskOrder,
    include: { tags: { include: { tag: true } } },
  },
  tags: { include: { tag: true } },
  attachments: { orderBy: { uploadDate: "desc" as const } },
  checklistItems: { orderBy: { position: "asc" as const } },
  user: { select: { id: true, username: true, displayName: true, language: true, notificationEmail: true, email: true } },
  collaborators: {
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  },
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
type RawCollaborator = { user: { id: string; username: string; displayName: string | null; avatarUrl: string | null } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTask(task: RawTask): any {
  const { tags, subTasks, attachments, checklistItems, collaborators, ...rest } = task;
  return {
    ...rest,
    type: rest.type || "TEXT",
    tags: (tags as RawTaskTag[] | undefined)?.map((t) => t.tag) ?? [],
    subTasks: (subTasks as RawTask[] | undefined)?.map(formatTask) ?? [],
    attachments: (attachments as RawAttachment[] | undefined) ?? [],
    checklistItems: (checklistItems as RawChecklistItem[] | undefined) ?? [],
    collaborators: (collaborators as RawCollaborator[] | undefined)?.map((c) => c.user) ?? [],
  };
}

export class TaskService {
  private async canAccessTask(userId: string, taskId: string): Promise<{ isOwner: boolean; task: unknown }> {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
      include: taskInclude,
    });
    if (!task) throw new AppError(404, "Task not found");
    return { isOwner: task.userId === userId, task };
  }

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

  async findShared(userId: string) {
    const tasks = await prisma.task.findMany({
      where: {
        userId: { not: userId },
        collaborators: { some: { userId } },
        parentTaskId: null,
      },
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });
    return tasks.map(formatTask);
  }

  async findById(userId: string, taskId: string) {
    const { task } = await this.canAccessTask(userId, taskId);
    return formatTask(task as RawTask);
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
    await this.canAccessTask(userId, taskId);

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

    return formatTask(task as unknown as RawTask);
  }

  async delete(userId: string, taskId: string) {
    const { isOwner } = await this.canAccessTask(userId, taskId);
    if (!isOwner) throw new AppError(403, "Only the task owner can delete this task");

    await prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { parentTaskId: taskId } });
      await tx.task.delete({ where: { id: taskId } });
    });
  }

  async addCollaborator(userId: string, taskId: string, input: AddCollaboratorInput) {
    const { isOwner, task } = await this.canAccessTask(userId, taskId);
    if (!isOwner) throw new AppError(403, "Only the task owner can add collaborators");

    const collaborator = await prisma.user.findUnique({
      where: { username: input.username },
    });
    if (!collaborator) throw new AppError(404, "User not found");
    if (collaborator.id === userId) throw new AppError(400, "Cannot add yourself as collaborator");

    const existingCollab = await prisma.taskCollaborator.findUnique({
      where: { taskId_userId: { taskId, userId: collaborator.id } },
    });
    if (existingCollab) throw new AppError(400, "User is already a collaborator");

    await prisma.taskCollaborator.create({
      data: { taskId, userId: collaborator.id },
    });

    try {
      const owner = (task as { user: { username: string; language: string; notificationEmail: string | null; email: string } }).user;
      const lang = collaborator.language || "en";
      const emailTo = collaborator.notificationEmail || collaborator.email;
      if (emailTo) {
        const subject = t(lang, "taskSharedSubject").replace("{{inviter}}", owner.username);
        const body = t(lang, "taskSharedBody").replace("{{inviter}}", owner.username).replace("{{title}}", (task as { title: string }).title);
        const html = `<div style="font-family:system-ui,sans-serif;padding:20px;max-width:480px;margin:0 auto;">
          <h2 style="color:#14B8A6;">${subject}</h2>
          <p>${body}</p>
        </div>`;
        await sendEmail(emailTo, subject, html);
      }
    } catch {
      // email failure is non-critical
    }

    return formatTask(task as RawTask);
  }

  async removeCollaborator(userId: string, taskId: string, collaboratorUserId: string) {
    const { isOwner, task } = await this.canAccessTask(userId, taskId);
    if (!isOwner) throw new AppError(403, "Only the task owner can remove collaborators");

    const existing = await prisma.taskCollaborator.findUnique({
      where: { taskId_userId: { taskId, userId: collaboratorUserId } },
    });
    if (!existing) throw new AppError(404, "Collaborator not found");

    await prisma.taskCollaborator.delete({
      where: { taskId_userId: { taskId, userId: collaboratorUserId } },
    });

    return formatTask(task as RawTask);
  }

  async getCollaborators(userId: string, taskId: string) {
    await this.canAccessTask(userId, taskId);
    const collabs = await prisma.taskCollaborator.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    return collabs.map((c: { user: { id: string; username: string; displayName: string | null; avatarUrl: string | null } }) => c.user);
  }

  async addTag(userId: string, taskId: string, tagId: string) {
    await this.canAccessTask(userId, taskId);

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
    await this.canAccessTask(userId, taskId);

    await prisma.taskTag.deleteMany({
      where: { taskId, tagId },
    });

    return this.findById(userId, taskId);
  }
}
