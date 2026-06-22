import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import createError from "http-errors";
import { validateFile } from "../../utils/file-validator";

const UPLOAD_DIR = path.resolve("uploads");

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export class AttachmentService {
  async getMaxUploadSize(): Promise<number> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "maxUploadSize" },
    });
    return setting ? Number(setting.value) : env.MAX_UPLOAD_SIZE;
  }

  private async getMaxStoragePerUser(): Promise<number> {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "maxStoragePerUser" },
    });
    // return value in bytes (default 1 GB)
    return setting ? Number(setting.value) : 1073741824;
  }

  async upload(userId: string, taskId: string, file: { filename: string; buffer: Buffer; mimetype: string }) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
    });
    if (!task) throw createError.NotFound("Task not found");

    const maxSize = await this.getMaxUploadSize();
    const sizeBytes = maxSize * 1024 * 1024;
    const validation = validateFile(file.buffer, file.mimetype, sizeBytes);
    if (!validation.valid) {
      throw createError.BadRequest(validation.error!);
    }
    const sizeMB = file.buffer.length / (1024 * 1024);
    if (sizeMB > maxSize) {
      throw createError.PayloadTooLarge( `File exceeds the ${maxSize}MB upload limit`);
    }

    // Check storage quota
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (!user) throw createError.NotFound("User not found");

    const globalMax = await this.getMaxStoragePerUser();
    const maxStorage = Number(user.storageQuota) || globalMax;
    const currentUsed = Number(user.storageUsed);
    if (currentUsed + file.buffer.length > maxStorage) {
      throw createError.PayloadTooLarge( "Storage quota exceeded. Free up space or contact your admin.");
    }

    await ensureUploadDir();

    const ext = path.extname(file.filename) || "";
    const safeName = `${randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    await fs.writeFile(filePath, file.buffer);

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.filename,
        fileUrl: `/uploads/${safeName}`,
        fileSize: file.buffer.length,
        taskId,
      },
    });

    // Increment user storage
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { increment: file.buffer.length } },
    });

    return attachment;
  }

  async findByTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
    });
    if (!task) throw createError.NotFound("Task not found");

    return prisma.attachment.findMany({
      where: { taskId },
      orderBy: { uploadDate: "desc" },
    });
  }

  async delete(userId: string, taskId: string, attachmentId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { collaborators: { some: { userId } } },
        ],
      },
    });
    if (!task) throw createError.NotFound("Task not found");

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!attachment) throw createError.NotFound("Attachment not found");

    const filePath = path.resolve(attachment.fileUrl.replace(/^\//, ""));
    try {
      await fs.unlink(filePath);
    } catch {
      // file might already be gone
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    // Decrement user storage
    await prisma.user.update({
      where: { id: userId },
      data: { storageUsed: { decrement: Number(attachment.fileSize) } },
    });
  }
}
