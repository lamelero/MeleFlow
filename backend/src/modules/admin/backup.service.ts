import path from "path";
import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { createGzip, createGunzip } from "zlib";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";

const BACKUP_DIR = path.resolve("backups");
const UPLOAD_DIR = path.resolve("uploads");

const EXPORTED_MODELS = [
  "user", "list", "tag", "task", "taskTag", "checklistItem",
  "attachment", "habit", "habitLog",
  "pomodoroSession",
  "refreshToken", "securityLog", "systemSetting",
  "taskCollaborator",
] as const;

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new AppError(500, "Encryption key not configured or too short (needs 32+ chars)");
  }
  return Buffer.from(key.slice(0, 32).padEnd(32, "x"));
}

async function exportDatabase(): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};
  const db = prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  for (const model of EXPORTED_MODELS) {
    try {
      const records = await db[model].findMany();
      data[model] = records as unknown[];
    } catch {
      data[model] = [];
    }
  }
  return data;
}

async function writeTar(dir: string, dbJson: Record<string, unknown[]>): Promise<string> {
  const tmpDir = path.join(BACKUP_DIR, ".tmp-" + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, "db.json"), JSON.stringify(dbJson, (_, v) =>
      typeof v === "bigint" ? Number(v) : v, 2));

    try {
      const uploadFiles = await fs.readdir(UPLOAD_DIR).catch(() => []);
      if (uploadFiles.length > 0) {
        const uploadsTmp = path.join(tmpDir, "uploads");
        await fs.mkdir(uploadsTmp, { recursive: true });
        for (const file of uploadFiles) {
          const src = path.join(UPLOAD_DIR, file);
          const stat = await fs.stat(src).catch(() => null);
          if (stat?.isFile()) {
            await fs.cp(src, path.join(uploadsTmp, file));
          }
        }
      }
    } catch {
      // uploads copy is non-critical
    }

    const tarName = `melenote-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.tar.gz`;
    const tarPath = path.join(BACKUP_DIR, tarName);

    // Use tar CLI for simplicity
    const { execSync } = await import("child_process");
    execSync(`tar -czf "${tarPath}" -C "${tmpDir}" .`, { stdio: "pipe" });

    return tarPath;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function encryptFile(filePath: string): Promise<string> {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);

  const encPath = filePath + ".enc";
  const readStream = createReadStream(filePath);
  const writeStream = createWriteStream(encPath);

  writeStream.write(iv);

  return new Promise((resolve, reject) => {
    pipeline(readStream, cipher, writeStream)
      .then(() => {
        fs.unlink(filePath).catch(() => {});
        resolve(encPath);
      })
      .catch(reject);
  });
}

function decryptFile(filePath: string): Promise<string> {
  const key = getEncryptionKey();
  const decPath = filePath.replace(/\.enc$/, "") + ".dec";

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(filePath);
    readStream.once("readable", () => {
      const iv = readStream.read(16);
      if (!iv || iv.length !== 16) {
        reject(new Error("Invalid encrypted file"));
        return;
      }
      const decipher = createDecipheriv("aes-256-cbc", key, iv);
      const writeStream = createWriteStream(decPath);
      pipeline(readStream, decipher, writeStream)
        .then(() => resolve(decPath))
        .catch(reject);
    });
  });
}

async function clearDatabase() {
  const deleteOrder = [
    "securityLog", "refreshToken", "pomodoroSession",
    "habitLog", "habit",
    "taskCollaborator", "attachment", "checklistItem", "taskTag", "task",
    "tag", "list", "user",
    "systemSetting",
  ];

  const db = prisma as unknown as Record<string, { deleteMany: () => Promise<{ count: number }> }>;

  for (const model of deleteOrder) {
    try {
      const { count } = await db[model].deleteMany();
      if (count > 0) console.log(`[Backup] Cleared ${count} ${model} records`);
    } catch (err) {
      console.error(`[Backup] Error clearing ${model}:`, err);
    }
  }
}

async function importDatabase(dbJson: Record<string, unknown[]>): Promise<{ warnings: string[] }> {
  const order = [
    "systemSetting",
    "user", "list", "tag",
    "task", "taskTag", "checklistItem", "attachment", "taskCollaborator",
    "habit", "habitLog",
    "pomodoroSession",
    "refreshToken", "securityLog",
  ];

  const db = prisma as unknown as Record<string, { upsert: (args: { where: { id: string }; create: unknown; update: unknown }) => Promise<unknown> }>;

  const warnings: string[] = [];

  for (const model of order) {
    const records = dbJson[model];
    if (!records || records.length === 0) continue;
    let modelErrors = 0;
    for (const record of records) {
      try {
        await db[model].upsert({
          where: { id: (record as Record<string, string>).id },
          create: record,
          update: record,
        });
      } catch (err) {
        modelErrors++;
        if (modelErrors === 1) {
          warnings.push(`${model}: ${(err as Error).message}`);
        }
      }
    }
    if (modelErrors > 0) {
      console.error(`[Backup] ${model}: ${modelErrors} record(s) failed during import`);
    }
  }

  return { warnings };
}

export class BackupService {
  async createBackup(encrypt = false): Promise<{ name: string; size: number }> {
    await ensureBackupDir();
    console.log("[Backup] Exporting database...");
    const dbJson = await exportDatabase();
    console.log("[Backup] Creating archive...");
    let tarPath = await writeTar(BACKUP_DIR, dbJson);
    const stat = await fs.stat(tarPath);

    if (encrypt) {
      console.log("[Backup] Encrypting...");
      tarPath = await encryptFile(tarPath);
    }

    const name = path.basename(tarPath);
    const size = stat.size;
    console.log(`[Backup] Created: ${name} (${(size / 1024 / 1024).toFixed(1)} MB)`);

    // Enforce retention
    await this.enforceRetention();

    return { name, size };
  }

  async listBackups(): Promise<{ name: string; size: number; date: string; encrypted: boolean }[]> {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUP_DIR);
    const backups = [];

    for (const file of files) {
      if (!file.startsWith("melenote-backup")) continue;
      const filePath = path.join(BACKUP_DIR, file);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) continue;
      backups.push({
        name: file,
        size: stat.size,
        date: stat.mtime.toISOString(),
        encrypted: file.endsWith(".enc"),
      });
    }

    backups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return backups;
  }

  async downloadBackup(name: string): Promise<{ path: string; stream: NodeJS.ReadableStream }> {
    await this.assertBackupExists(name);
    const filePath = path.join(BACKUP_DIR, name);
    return { path: filePath, stream: createReadStream(filePath) };
  }

  async deleteBackup(name: string): Promise<void> {
    await this.assertBackupExists(name);
    await fs.unlink(path.join(BACKUP_DIR, name));
  }

  async restoreFromDisk(name: string): Promise<{ warnings: string[] }> {
    const filePath = path.join(BACKUP_DIR, name);
    await this.assertBackupExists(name);

    let extractPath = filePath;
    let cleanupPath: string | null = null;

    if (name.endsWith(".enc")) {
      console.log("[Backup] Decrypting...");
      extractPath = await decryptFile(filePath);
      cleanupPath = extractPath;
    }

    const result = await this.restoreFromPath(extractPath);

    if (cleanupPath) await fs.unlink(cleanupPath).catch(() => {});

    return result;
  }

  async restoreFromUpload(file: { buffer: Buffer; filename: string }): Promise<{ warnings: string[] }> {
    const tmpPath = path.join(BACKUP_DIR, ".upload-" + Date.now() + path.extname(file.filename));
    await fs.writeFile(tmpPath, file.buffer);
    try {
      return await this.restoreFromPath(tmpPath);
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  private async restoreFromPath(archivePath: string): Promise<{ warnings: string[] }> {
    const tmpDir = path.join(BACKUP_DIR, ".restore-" + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      const { execSync } = await import("child_process");
      execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { stdio: "pipe" });

      const dbPath = path.join(tmpDir, "db.json");
      const dbJson = JSON.parse(await fs.readFile(dbPath, "utf-8"));

      const uploadsSrc = path.join(tmpDir, "uploads");
      const uploadsExist = await fs.stat(uploadsSrc).then(() => true).catch(() => false);

      if (uploadsExist) {
        const files = await fs.readdir(uploadsSrc);
        for (const file of files) {
          const src = path.join(uploadsSrc, file);
          const dst = path.join(UPLOAD_DIR, file);
          await fs.cp(src, dst, { force: true });
        }
      }

      console.log("[Backup] Clearing existing data...");
      await clearDatabase();

      console.log("[Backup] Importing database...");
      const { warnings } = await importDatabase(dbJson);

      if (warnings.length > 0) {
        console.warn(`[Backup] Restore completed with ${warnings.length} warning(s):`, warnings.join("; "));
      } else {
        console.log("[Backup] Restore complete!");
      }

      return { warnings };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  async getSettings() {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["backupInterval", "backupRetention", "backupEncrypted"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      backupInterval: map.backupInterval || "manual",
      backupRetention: Number(map.backupRetention) || 10,
      backupEncrypted: map.backupEncrypted === "true",
    };
  }

  async updateSettings(input: { backupInterval?: string; backupRetention?: number; backupEncrypted?: boolean }) {
    const upsert = async (key: string, value: string) => {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    };
    if (input.backupInterval) await upsert("backupInterval", input.backupInterval);
    if (input.backupRetention !== undefined) await upsert("backupRetention", String(input.backupRetention));
    if (input.backupEncrypted !== undefined) await upsert("backupEncrypted", String(input.backupEncrypted));
    return this.getSettings();
  }

  private async assertBackupExists(name: string) {
    const filePath = path.join(BACKUP_DIR, name);
    const exists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!exists) throw new AppError(404, "Backup not found");
  }

  private async enforceRetention() {
    const settings = await this.getSettings();
    const maxBackups = settings.backupRetention;
    if (maxBackups <= 0) return;

    const backups = await this.listBackups();
    if (backups.length <= maxBackups) return;

    const toDelete = backups.slice(maxBackups);
    for (const b of toDelete) {
      await fs.unlink(path.join(BACKUP_DIR, b.name)).catch(() => {});
      console.log(`[Backup] Deleted old backup: ${b.name}`);
    }
  }
}

export async function runScheduledBackup() {
  const service = new BackupService();
  const settings = await service.getSettings();
  if (settings.backupInterval === "manual") return;
  await service.createBackup(settings.backupEncrypted);
}
