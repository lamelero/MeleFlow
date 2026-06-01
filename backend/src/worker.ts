import { config } from "dotenv";
config();

import cron from "node-cron";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { sendEmail, buildReminderEmail } from "./lib/email-service";

console.log(" MeleNotes Worker started — checking for reminders every minute");

// ── Reminder check every minute ────────────────
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60000);

    const tasks = await prisma.task.findMany({
      where: {
        isCompleted: false,
        dueDate: { gte: now, lte: in24h },
      },
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
    });

    for (const task of tasks) {
      const reminderKey = `reminder:sent:${task.id}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) continue;

      if (!task.user.email) continue;

      // Build subject from template
      const subject = `Reminder: "${task.title}" is due soon`;

      const html = buildReminderEmail(
        task.user.username,
        task.title,
        task.dueDate?.toISOString() ?? "",
        "http://localhost:5173/app",
      );

      const sent = await sendEmail(task.user.email, subject, html);

      if (sent) {
        console.log(`[Worker] Email sent to ${task.user.email} for task "${task.title}"`);
      } else {
        console.log(`[Worker] Email skipped (disabled or misconfigured) for task "${task.title}"`);
      }

      // Set TTL to prevent re-sending (24 hours)
      await redis.set(reminderKey, "1", "EX", 86400);
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
