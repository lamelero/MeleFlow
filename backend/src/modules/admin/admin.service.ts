import path from "path";
import fs from "fs/promises";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import createError from "http-errors";
import type { UpdateUserInput, UpdateSettingsInput } from "./admin.schema";

export class AdminService {
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        storageUsed: true,
        storageQuota: true,
        timezone: true,
        sedeId: true,
        diasVac: true,
        sede: { select: { id: true, nombre: true } },
        _count: {
          select: { tasks: true, lists: true, habits: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateUser(currentUserId: string, targetUserId: string, input: UpdateUserInput) {
    if (currentUserId === targetUserId && input.role !== undefined) {
      throw createError.BadRequest( "Cannot change your own role");
    }
    if (currentUserId === targetUserId && input.isActive === false) {
      throw createError.BadRequest( "Cannot deactivate yourself");
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw createError.NotFound( "User not found");
    }

    if (input.email && input.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw createError.Conflict( "Email already taken");
    }
    if (input.username && input.username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: input.username } });
      if (existing) throw createError.Conflict( "Username already taken");
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(input.email !== undefined && { email: input.email }),
        ...(input.username !== undefined && { username: input.username }),
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.storageQuota !== undefined && { storageQuota: input.storageQuota }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.sedeId !== undefined && { sedeId: input.sedeId }),
        ...(input.diasVac !== undefined && { diasVac: input.diasVac }),
        ...(input.password !== undefined && { passwordHash: await bcrypt.hash(input.password, 12) }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        storageQuota: true,
        timezone: true,
        sedeId: true,
        diasVac: true,
      },
    });
  }

  async clearLoginAttempts(userId: string): Promise<{ cleared: number }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError.NotFound("User not found");
    const result = await prisma.failedLoginAttempt.deleteMany({ where: { email: user.email } });
    return { cleared: result.count };
  }

  async deleteUser(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw createError.BadRequest( "Cannot delete yourself");
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw createError.NotFound( "User not found");
    }

    // Clean up related records before deleting the user (avoids cascade issues)
    try {
      await prisma.fichajeSesion.deleteMany({ where: { userId: targetUserId } });
      await prisma.calendarioEmpleado.deleteMany({ where: { userId: targetUserId } });
      await prisma.vacacion.deleteMany({ where: { userId: targetUserId } });
      await prisma.bajaLaboral.deleteMany({ where: { userId: targetUserId } });
      await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } });
      await prisma.deviceToken.deleteMany({ where: { userId: targetUserId } });

      // Reassign projects and portfolio items created by the deleted user
      await prisma.project.updateMany({ where: { createdBy: targetUserId }, data: { createdBy: currentUserId } });
      await prisma.portfolioItem.updateMany({ where: { createdBy: targetUserId }, data: { createdBy: currentUserId } });

      // Nullify references that don't cascade
      await prisma.portfolioItem.updateMany({ where: { assignedTo: targetUserId }, data: { assignedTo: null } });
      await prisma.vacacion.updateMany({ where: { approverId: targetUserId }, data: { approverId: null } });
    } catch (err) {
      console.error("[Admin] Error cleaning up user data:", err);
    }

    await prisma.user.delete({ where: { id: targetUserId } });
  }

  async getSettings() {
    const rows = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      allowRegistration: map.allowRegistration !== undefined
        ? map.allowRegistration === "true"
        : env.ALLOW_REGISTRATION,
      maxUploadSize: map.maxUploadSize !== undefined
        ? Number(map.maxUploadSize)
        : env.MAX_UPLOAD_SIZE,
      maxStoragePerUser: map.maxStoragePerUser !== undefined
        ? Number(map.maxStoragePerUser)
        : 1073741824,
      maxLoginAttempts: map.maxLoginAttempts !== undefined
        ? Number(map.maxLoginAttempts)
        : env.MAX_LOGIN_ATTEMPTS,
      loginLockoutMinutes: map.loginLockoutMinutes !== undefined
        ? Number(map.loginLockoutMinutes)
        : env.LOGIN_LOCKOUT_MINUTES,
      smtpHost: map.smtpHost || "",
      smtpPort: map.smtpPort ? Number(map.smtpPort) : 587,
      smtpUser: map.smtpUser || "",
      smtpPassword: map.smtpPassword ? "••••••••" : "",
      fromEmail: map.fromEmail || "",
      fromName: map.fromName ? map.fromName : "MeleFlow",
      emailEnabled: map.emailEnabled === "true",
      emailSubject: map.emailSubject || "Reminder: {{title}} is due soon",
      logoUrl: map.logoUrl || "",
      frontendUrl: map.frontendUrl || env.FRONTEND_URL || env.CORS_ORIGIN || "http://localhost:3001",
    };
  }

  async uploadLogo(data: Buffer, ext: string, variant: "light" | "dark" = "light") {
    const prefix = variant === "dark" ? "logo-dark" : "logo-light";
    const filename = `${prefix}-${Date.now()}${ext}`;
    const dbKey = variant === "dark" ? "logoUrlDark" : "logoUrl";
    const uploadDir = path.resolve("uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Remove old logo files for this variant
    const existing = (await fs.readdir(uploadDir).catch(() => []))
      .filter((f) => f.startsWith(`${prefix}-`));
    await Promise.all(existing.map((f) => fs.unlink(path.join(uploadDir, f)).catch(() => {})));

    await fs.writeFile(path.join(uploadDir, filename), data);

    const logoUrl = `/uploads/${filename}`;
    await prisma.systemSetting.upsert({
      where: { key: dbKey },
      create: { key: dbKey, value: logoUrl },
      update: { value: logoUrl },
    });

    return { [variant === "dark" ? "logoUrlDark" : "logoUrl"]: logoUrl };
  }

  async removeLogo(variant: "light" | "dark" = "light") {
    const prefix = variant === "dark" ? "logo-dark" : "logo-light";
    const dbKey = variant === "dark" ? "logoUrlDark" : "logoUrl";
    const uploadDir = path.resolve("uploads");
    const existing = (await fs.readdir(uploadDir).catch(() => []))
      .filter((f) => f.startsWith(`${prefix}-`));
    await Promise.all(existing.map((f) => fs.unlink(path.join(uploadDir, f)).catch(() => {})));

    await prisma.systemSetting.upsert({
      where: { key: dbKey },
      create: { key: dbKey, value: "" },
      update: { value: "" },
    });

    return { [variant === "dark" ? "logoUrlDark" : "logoUrl"]: null };
  }

  async updateSettings(input: UpdateSettingsInput) {
    const upsert = async (key: string, value: string) => {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    };

    if (input.allowRegistration !== undefined) {
      await upsert("allowRegistration", String(input.allowRegistration));
    }
    if (input.maxUploadSize !== undefined) {
      await upsert("maxUploadSize", String(input.maxUploadSize));
    }
    if (input.maxStoragePerUser !== undefined) {
      await upsert("maxStoragePerUser", String(input.maxStoragePerUser));
    }
    if (input.maxLoginAttempts !== undefined) {
      await upsert("maxLoginAttempts", String(input.maxLoginAttempts));
    }
    if (input.loginLockoutMinutes !== undefined) {
      await upsert("loginLockoutMinutes", String(input.loginLockoutMinutes));
    }
    if (input.smtpHost !== undefined) {
      await upsert("smtpHost", input.smtpHost);
    }
    if (input.smtpPort !== undefined) {
      await upsert("smtpPort", String(input.smtpPort));
    }
    if (input.smtpUser !== undefined) {
      await upsert("smtpUser", input.smtpUser);
    }
    if (input.smtpPassword !== undefined && input.smtpPassword !== "••••••••") {
      await upsert("smtpPassword", input.smtpPassword);
    }
    if (input.fromEmail !== undefined) {
      await upsert("fromEmail", input.fromEmail);
    }
    if (input.fromName !== undefined) {
      await upsert("fromName", input.fromName);
    }
    if (input.emailEnabled !== undefined) {
      await upsert("emailEnabled", String(input.emailEnabled));
    }
    if (input.emailSubject !== undefined) {
      await upsert("emailSubject", input.emailSubject);
    }
    if (input.frontendUrl !== undefined) {
      await upsert("frontendUrl", input.frontendUrl);
    }

    // Reset email transporter so new SMTP settings take effect immediately
    if (input.smtpHost !== undefined || input.smtpPort !== undefined || input.smtpUser !== undefined || input.smtpPassword !== undefined || input.smtpPassword === "••••••••" || input.fromEmail !== undefined || input.emailEnabled !== undefined) {
      const { resetTransport } = await import("../../lib/email-service");
      resetTransport();
    }

    return this.getSettings();
  }

  async getSecurityLogs(limit: number, offset: number) {
    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, username: true } },
        },
      }),
      prisma.securityLog.count(),
    ]);

    return { logs, total, limit, offset };
  }

  async getStats() {
    const [
      totalUsers,
      totalTasks,
      completedTasks,
      totalLists,
      totalHabits,
      totalPomodoros,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.task.count({ where: { isCompleted: true } }),
      prisma.list.count(),
      prisma.habit.count(),
      prisma.pomodoroSession.count({ where: { state: "COMPLETED" } }),
    ]);

    return {
      totalUsers,
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalLists,
      totalHabits,
      totalPomodoros,
    };
  }

  async wipeAllData(adminId: string, password: string) {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw createError.NotFound( "Admin not found");

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw createError.Forbidden( "Invalid password");

    const uploadDir = path.resolve("uploads");

    await prisma.$transaction([
      prisma.taskCollaborator.deleteMany(),
      prisma.taskTag.deleteMany(),
      prisma.checklistItem.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.pomodoroSession.deleteMany(),
      prisma.task.deleteMany(),
      prisma.habitLog.deleteMany(),
      prisma.habit.deleteMany(),
      prisma.list.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.refreshToken.deleteMany(),
      prisma.securityLog.deleteMany(),
      prisma.failedLoginAttempt.deleteMany(),
      prisma.user.deleteMany(),
      prisma.systemSetting.deleteMany(),
    ]);

    // Remove uploaded files
    try {
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        await fs.unlink(path.join(uploadDir, file)).catch(() => {});
      }
    } catch {
      // uploads dir might not exist
    }

    // Flush Redis
    try {
      await redis.flushall();
    } catch {
      // Redis might not be available
    }

    return { wiped: true };
  }
}
