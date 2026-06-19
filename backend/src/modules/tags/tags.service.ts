import { prisma } from "../../config/database";
import createError from "http-errors";
import type { CreateTagInput, UpdateTagInput } from "./tags.schema";

export class TagService {
  async findAll(userId: string) {
    return prisma.tag.findMany({
      where: { userId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { name: "asc" },
    });
  }

  async create(userId: string, input: CreateTagInput) {
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId, name: input.name } },
    });

    if (existing) {
      throw createError.Conflict( "A tag with this name already exists");
    }

    return prisma.tag.create({
      data: { userId, ...input },
    });
  }

  async update(userId: string, tagId: string, input: UpdateTagInput) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw createError.NotFound( "Tag not found");
    }

    if (input.name && input.name !== tag.name) {
      const existing = await prisma.tag.findUnique({
        where: { userId_name: { userId, name: input.name } },
      });
      if (existing) {
        throw createError.Conflict( "A tag with this name already exists");
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: input,
    });
  }

  async delete(userId: string, tagId: string) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw createError.NotFound( "Tag not found");
    }

    await prisma.tag.delete({ where: { id: tagId } });
  }
}
