import { config } from "dotenv";
config();

import cron from "node-cron";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { sendEmail, buildReminderEmail } from "./lib/email-service";
import { t } from "./lib/email-i18n";
import { HabitService } from "./modules/habits/habits.service";

const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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
        user: { select: { id: true, email: true, username: true, notificationEmail: true, language: true, timezone: true } },
      },
    });

    for (const task of tasks) {
      const reminderKey = `reminder:sent:${task.id}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) continue;

      const emailTo = task.user.notificationEmail || task.user.email;
      if (!emailTo) continue;
      const lang = task.user.language || "en";

      const subject = t(lang, "taskSubject").replace("{{title}}", task.title);

      const html = buildReminderEmail(
        task.user.username,
        task.title,
        t(lang, "taskBody"),
        task.dueDate?.toISOString() ?? "",
        APP_URL,
        lang,
      );

      const sent = await sendEmail(emailTo, subject, html);

      if (sent) {
        console.log(`[Worker] Email sent to ${emailTo} for task "${task.title}"`);
      } else {
        console.log(`[Worker] Email skipped (disabled or misconfigured) for task "${task.title}"`);
      }

      // Set TTL to prevent re-sending (24 hours)
      await redis.set(reminderKey, "1", "EX", 86400);
    }

    if (tasks.length > 0) {
      console.log(`[Worker] Processed ${tasks.length} task reminder(s)`);
    }

    // ── Habit reminders ───────────────────────────
    const habitService = new HabitService();
    const habits = await habitService.findHabitsDueForReminder();

    console.log(`[Worker] Found ${habits.length} habit(s) due for reminder`);

    for (const habit of habits) {
      const today = new Date().toISOString().split("T")[0];
      const reminderKey = `reminder:habit:${habit.id}:${today}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) continue;

      const emailTo = habit.user.notificationEmail || habit.user.email;
      if (!emailTo) continue;
      const lang = habit.user.language || "en";

      const subject = t(lang, "habitSubject").replace("{{name}}", habit.name);
      const message = t(lang, "habitBody").replace("{{name}}", `<strong>${habit.name}</strong>`);
      const html = buildReminderEmail(
        habit.user.username,
        habit.name,
        message,
        "",
        APP_URL,
        lang,
      );

      const sent = await sendEmail(emailTo, subject, html);

      if (sent) {
        console.log(`[Worker] Habit reminder sent to ${emailTo} for "${habit.name}" (${today})`);
      } else {
        console.log(`[Worker] Habit reminder skipped (disabled/misconfigured) for "${habit.name}" (${today})`);
      }

      await redis.set(reminderKey, "1", "EX", 86400);
    }

  } catch (err) {
    console.error("[Worker] Error processing reminders:", err);
  }
});

// Keep alive
setInterval(() => {}, 60000);
