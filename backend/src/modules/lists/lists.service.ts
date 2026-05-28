import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateListInput, UpdateListInput } from "./lists.schema";

export class ListService {
  async findAll(userId: string) {
    return prisma.list.findMany({
      where: { userId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, input: CreateListInput) {
    const existing = await prisma.list.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });

    if (existing) {
      throw new AppError(409, "A list with this name already exists");
    }

    return prisma.list.create({
      data: { userId, ...input },
      include: { _count: { select: { tasks: true } } },
    });
  }

  async update(userId: string, listId: string, input: UpdateListInput) {
    const list = await prisma.list.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError(404, "List not found");
    }

    if (input.name && input.name !== list.name) {
      const existing = await prisma.list.findUnique({
        where: { userId_name: { userId, name: input.name } },
      });
      if (existing) {
        throw new AppError(409, "A list with this name already exists");
      }
    }

    return prisma.list.update({
      where: { id: listId },
      data: input,
      include: { _count: { select: { tasks: true } } },
    });
  }

  async delete(userId: string, listId: string) {
    const list = await prisma.list.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      throw new AppError(404, "List not found");
    }

    await prisma.list.delete({
      where: { id: listId },
    });
  }
}
