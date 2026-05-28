import { config } from "dotenv";
config();

import cron from "node-cron";
import { prisma } from "./config/database";
import { redis } from "./config/redis";

console.log("📋 MeleNotes Worker started — checking for reminders every minute");

// ── Reminder check every minute ────────────────
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const in10Min = new Date(now.getTime() + 10 * 60000);

    const tasks = await prisma.task.findMany({
      where: {
        isCompleted: false,
        dueDate: { gte: now, lte: in10Min },
      },
      include: {
        user: { select: { email: true, username: true } },
      },
    });

    for (const task of tasks) {
      const reminderKey = `reminder:sent:${task.id}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) continue;

      console.log(
        `[Reminder] "${task.title}" is due at ${task.dueDate?.toISOString()} for ${task.user.username}`,
      );

      // Set TTL to prevent re-sending (1 hour)
      await redis.set(reminderKey, "1", "EX", 3600);
    }

    if (tasks.length > 0) {
      console.log(`[Worker] Processed ${tasks.length} reminder(s)`);
    }
  } catch (err) {
    console.error("[Worker] Error processing reminders:", err);
  }
});

// Keep alive
setInterval(() => {}, 60000);
