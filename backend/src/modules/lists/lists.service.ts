import { prisma } from "../../config/database";
import createError from "http-errors";
import type { CreateListInput, UpdateListInput } from "./lists.schema";

export class ListService {
  async findAll(userId: string) {
    return prisma.list.findMany({
      where: { userId, deletedAt: null },
      include: {
        _count: {
          select: {
            tasks: { where: { isCompleted: false, deletedAt: null } },
          },
        },
      },
      omit: { syncVersion: true, deletedAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, input: CreateListInput) {
    const existing = await prisma.list.findFirst({
      where: { userId, name: input.name, deletedAt: null },
    });

    if (existing) {
      throw createError.Conflict( "A list with this name already exists");
    }

    return prisma.list.create({
      data: { userId, ...input },
      include: {
        _count: {
          select: {
            tasks: { where: { isCompleted: false, deletedAt: null } },
          },
        },
      },
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async update(userId: string, listId: string, input: UpdateListInput) {
    const list = await prisma.list.findFirst({
      where: { id: listId, userId, deletedAt: null },
    });

    if (!list) {
      throw createError.NotFound( "List not found");
    }

    if (input.name && input.name !== list.name) {
      const existing = await prisma.list.findFirst({
        where: {
          userId,
          name: input.name,
          deletedAt: null,
          id: { not: listId },
        },
      });
      if (existing) {
        throw createError.Conflict( "A list with this name already exists");
      }
    }

    return prisma.list.update({
      where: { id: listId },
      data: input,
      include: {
        _count: {
          select: {
            tasks: { where: { isCompleted: false, deletedAt: null } },
          },
        },
      },
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async delete(userId: string, listId: string) {
    const list = await prisma.list.findFirst({
      where: { id: listId, userId, deletedAt: null },
    });

    if (!list) {
      throw createError.NotFound( "List not found");
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { userId, listId, deletedAt: null },
        data: { listId: null },
      }),
      prisma.list.update({
        where: { id: listId },
        data: { deletedAt: now },
      }),
    ]);
  }
}
