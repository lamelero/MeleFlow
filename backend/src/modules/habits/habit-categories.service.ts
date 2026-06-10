import { prisma } from "../../config/database";
import { AppError } from "../../lib/app-error";
import type { CreateCategoryInput, UpdateCategoryInput } from "./habit-categories.schema";

export class HabitCategoryService {
  async findAll(userId: string) {
    return prisma.habitCategoryModel.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      include: { _count: { select: { habits: true } } },
    });
  }

  async create(userId: string, input: CreateCategoryInput) {
    const existing = await prisma.habitCategoryModel.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });
    if (existing) throw new AppError(409, "Category with this name already exists");

    return prisma.habitCategoryModel.create({
      data: { ...input, userId },
    });
  }

  async update(userId: string, id: string, input: UpdateCategoryInput) {
    const cat = await prisma.habitCategoryModel.findFirst({ where: { id, userId } });
    if (!cat) throw new AppError(404, "Category not found");

    if (input.name && input.name !== cat.name) {
      const existing = await prisma.habitCategoryModel.findUnique({
        where: { userId_name: { userId, name: input.name } },
      });
      if (existing) throw new AppError(409, "Category with this name already exists");
    }

    return prisma.habitCategoryModel.update({ where: { id }, data: input });
  }

  async delete(userId: string, id: string) {
    const cat = await prisma.habitCategoryModel.findFirst({ where: { id, userId } });
    if (!cat) throw new AppError(404, "Category not found");

    await prisma.habitCategoryModel.delete({ where: { id } });
  }
}
