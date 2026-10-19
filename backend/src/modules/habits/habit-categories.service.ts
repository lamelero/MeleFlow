import { prisma } from "../../config/database";
import createError from "http-errors";
import type { CreateCategoryInput, UpdateCategoryInput } from "./habit-categories.schema";

export class HabitCategoryService {
  async findAll(userId: string) {
    return prisma.habitCategoryModel.findMany({
      where: { userId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { habits: { where: { deletedAt: null } } },
        },
      },
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async create(userId: string, input: CreateCategoryInput) {
    const existing = await prisma.habitCategoryModel.findFirst({
      where: { userId, name: input.name, deletedAt: null },
    });
    if (existing) throw createError.Conflict( "Category with this name already exists");

    return prisma.habitCategoryModel.create({
      data: { ...input, userId },
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async update(userId: string, id: string, input: UpdateCategoryInput) {
    const cat = await prisma.habitCategoryModel.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!cat) throw createError.NotFound( "Category not found");

    if (input.name && input.name !== cat.name) {
      const existing = await prisma.habitCategoryModel.findFirst({
        where: {
          userId,
          name: input.name,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existing) throw createError.Conflict( "Category with this name already exists");
    }

    return prisma.habitCategoryModel.update({
      where: { id },
      data: input,
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async delete(userId: string, id: string) {
    const cat = await prisma.habitCategoryModel.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!cat) throw createError.NotFound( "Category not found");

    const now = new Date();
    await prisma.$transaction([
      prisma.habit.updateMany({
        where: { userId, categoryId: id, deletedAt: null },
        data: { categoryId: null },
      }),
      prisma.habitCategoryModel.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);
  }
}
