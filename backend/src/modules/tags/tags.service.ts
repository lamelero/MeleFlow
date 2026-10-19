import { prisma } from "../../config/database";
import createError from "http-errors";
import type { CreateTagInput, UpdateTagInput } from "./tags.schema";

export class TagService {
  async findAll(userId: string) {
    return prisma.tag.findMany({
      where: { userId, deletedAt: null },
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null, task: { deletedAt: null } } },
          },
        },
      },
      omit: { syncVersion: true, deletedAt: true },
      orderBy: { name: "asc" },
    });
  }

  async create(userId: string, input: CreateTagInput) {
    const existing = await prisma.tag.findFirst({
      where: { userId, name: input.name, deletedAt: null },
    });

    if (existing) {
      throw createError.Conflict( "A tag with this name already exists");
    }

    return prisma.tag.create({
      data: { userId, ...input },
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async update(userId: string, tagId: string, input: UpdateTagInput) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId, deletedAt: null },
    });

    if (!tag) {
      throw createError.NotFound( "Tag not found");
    }

    if (input.name && input.name !== tag.name) {
      const existing = await prisma.tag.findFirst({
        where: {
          userId,
          name: input.name,
          deletedAt: null,
          id: { not: tagId },
        },
      });
      if (existing) {
        throw createError.Conflict( "A tag with this name already exists");
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: input,
      omit: { syncVersion: true, deletedAt: true },
    });
  }

  async delete(userId: string, tagId: string) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, userId, deletedAt: null },
    });

    if (!tag) {
      throw createError.NotFound( "Tag not found");
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.taskTag.updateMany({
        where: { tagId, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.tag.update({
        where: { id: tagId },
        data: { deletedAt: now },
      }),
    ]);
  }
}
