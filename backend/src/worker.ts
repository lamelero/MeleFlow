import { config } from "dotenv";
config();

import cron from "node-cron";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { sendEmail, buildReminderEmail, buildHabitReminderEmail } from "./lib/email-service";
import { t } from "./lib/email-i18n";
import { HabitService } from "./modules/habits/habits.service";
import { runScheduledBackup } from "./modules/admin/backup.service";
import { IcsCalendarService } from "./modules/ics-calendars/ics-calendars.service";

const DEFAULT_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3001";

async function getAppUrl(): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: "frontendUrl" } });
    if (row?.value) return row.value;
  } catch {
    // fallback
  }
  return DEFAULT_URL;
}

console.log(" MeleFlow Worker started — checking for reminders every minute");

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

    const appUrl = await getAppUrl();

    for (const task of tasks) {
      const reminderKey = `reminder:sent:${task.id}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) {
        console.log(`[Worker] Task already notified today, skipping "${task.title}"`);
        continue;
      }

      const emailTo = task.user.notificationEmail || task.user.email;
      if (!emailTo) {
        console.log(`[Worker] No email for user "${task.user.username}", skipping task "${task.title}"`);
        continue;
      }
      const lang = task.user.language || "en";

      const subject = t(lang, "taskSubject").replace("{{title}}", task.title);

      const html = buildReminderEmail(
        task.user.username,
        task.title,
        t(lang, "taskBody"),
        task.dueDate?.toISOString() ?? "",
        appUrl,
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

    // ── Task recurring reminders ───────────────────
    const recurringTasks = await prisma.task.findMany({
      where: {
        isCompleted: false,
        reminderEnabled: true,
        reminderConfig: { not: null },
      },
      include: {
        user: { select: { id: true, email: true, username: true, notificationEmail: true, language: true, timezone: true } },
      },
    });

    for (const task of recurringTasks) {
      try {
        const parsed = JSON.parse(task.reminderConfig!);

        // Extract reminders from array (new format) or legacy object
        interface RemEntry { time: string; frequency: string; days?: number[]; beforeDays?: number }
        const reminders: RemEntry[] = [];
        if (Array.isArray(parsed)) {
          for (const r of parsed) {
            if (r.time) reminders.push({ time: r.time, frequency: r.frequency || "always", days: r.days, beforeDays: r.beforeDays });
          }
        } else if (parsed?.type && parsed?.reminderTime) {
          if (parsed.type === "daily") reminders.push({ time: parsed.reminderTime, frequency: "always" });
          else if (parsed.type === "weekly" && Array.isArray(parsed.days) && parsed.days.length > 0) reminders.push({ time: parsed.reminderTime, frequency: "weekly", days: parsed.days });
        }

        if (reminders.length === 0) continue;

        const tz = task.user.timezone || "UTC";
        const now = new Date();
        const opts: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false };
        const userTimeStr = new Intl.DateTimeFormat("en-US", opts).format(now);
        const dayOpts: Intl.DateTimeFormatOptions = { timeZone: tz, weekday: "short" };
        const dayName = new Intl.DateTimeFormat("en-US", dayOpts).format(now);
        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const userDay = dayMap[dayName] ?? now.getDay();

        const todayStr = now.toISOString().split("T")[0];

        for (const rem of reminders) {
          if (userTimeStr !== rem.time) {
            console.log(`[Worker] "${task.title}" — time mismatch (user:${userTimeStr} config:${rem.time})`);
            continue;
          }

          if (rem.frequency === "weekly" && rem.days) {
            if (!rem.days.includes(userDay)) {
              console.log(`[Worker] "${task.title}" — day mismatch (today:${userDay} days:${JSON.stringify(rem.days)})`);
              continue;
            }
          }

          if (rem.frequency === "before_due" && task.dueDate) {
            const target = new Date(task.dueDate.getTime() - (rem.beforeDays ?? 0) * 86400000);
            const targetStr = target.toISOString().split("T")[0];
            if (todayStr !== targetStr) {
              console.log(`[Worker] "${task.title}" — before_due: target ${targetStr} != today ${todayStr}`);
              continue;
            }
          }

          const dedupKey = `reminder:task:recurring:${task.id}:${todayStr}:${rem.time}:${rem.frequency}`;
          const alreadySent = await redis.get(dedupKey);
          if (alreadySent) {
            console.log(`[Worker] Recurring task already notified for ${rem.time}, skipping "${task.title}"`);
            continue;
          }

          const emailTo = task.user.notificationEmail || task.user.email;
          if (!emailTo) {
            console.log(`[Worker] No email for user "${task.user.username}", skipping recurring task "${task.title}"`);
            continue;
          }
          const lang = task.user.language || "en";

          const subject = t(lang, "taskRecurringSubject").replace("{{title}}", task.title);
          const html = buildReminderEmail(
            task.user.username,
            task.title,
            t(lang, "taskRecurringBody"),
            "",
            appUrl,
            lang,
          );

          const sent = await sendEmail(emailTo, subject, html);
          if (sent) {
            console.log(`[Worker] Recurring reminder sent to ${emailTo} for task "${task.title}"`);
          } else {
            console.log(`[Worker] Recurring reminder skipped (disabled/misconfigured) for task "${task.title}"`);
          }

          await redis.set(dedupKey, "1", "EX", 86400);
        }
      } catch (err) {
        console.error(`[Worker] Error processing recurring reminder for task "${task.title}":`, err);
      }
    }

    if (recurringTasks.length > 0) {
      console.log(`[Worker] Processed ${recurringTasks.length} recurring task reminder(s)`);
    }

    // ── Habit reminders ───────────────────────────
    const habitService = new HabitService();
    const habits = await habitService.findHabitsDueForReminder();

    console.log(`[Worker] Found ${habits.length} habit(s) due for reminder`);

    for (const habit of habits) {
      const freq = JSON.parse(habit.frequency!);
      const remTime = freq.reminderTime || "00:00";
      const today = new Date().toISOString().split("T")[0];
      const reminderKey = `reminder:habit:${habit.id}:${today}:${remTime}`;
      const alreadySent = await redis.get(reminderKey);
      if (alreadySent) {
        console.log(`[Worker] Habit already notified at ${remTime}, skipping "${habit.name}"`);
        continue;
      }

      const emailTo = habit.user.notificationEmail || habit.user.email;
      if (!emailTo) {
        console.log(`[Worker] No email for user "${habit.user.username}", skipping habit "${habit.name}"`);
        continue;
      }
      const lang = habit.user.language || "en";

      const subject = t(lang, "habitSubject").replace("{{name}}", habit.name);
      const html = buildHabitReminderEmail(
        habit.user.username,
        habit.name,
        habit.category,
        habit.streakCount,
        appUrl,
        lang,
      );

      const sent = await sendEmail(emailTo, subject, html);

      if (sent) {
        console.log(`[Worker] Habit reminder sent to ${emailTo} for "${habit.name}" (${today} ${remTime})`);
      } else {
        console.log(`[Worker] Habit reminder skipped (disabled/misconfigured) for "${habit.name}" (${today} ${remTime})`);
      }

      await redis.set(reminderKey, "1", "EX", 86400);
    }

  } catch (err) {
    console.error("[Worker] Error processing reminders:", err);
  }
});

// ── Scheduled backup check ────────────────────
let lastBackupCheck = 0;

cron.schedule("* * * * *", async () => {
  try {
    const now = Date.now();
    if (now - lastBackupCheck < 60 * 60 * 1000) return;
    lastBackupCheck = now;

    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["backupInterval", "lastBackupRun"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const interval = map.backupInterval || "manual";
    if (interval === "manual") return;

    const lastRun = map.lastBackupRun ? new Date(map.lastBackupRun).getTime() : 0;
    const msSinceLastRun = Date.now() - lastRun;

    const intervals: Record<string, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const threshold = intervals[interval];
    if (!threshold || msSinceLastRun < threshold) return;

    console.log(`[Worker] Running scheduled backup (${interval})...`);
    await runScheduledBackup();

    await prisma.systemSetting.upsert({
      where: { key: "lastBackupRun" },
      create: { key: "lastBackupRun", value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });
    console.log("[Worker] Scheduled backup completed");
  } catch (err) {
    console.error("[Worker] Backup check error:", err);
  }
});

// ── ICS Calendar sync every 15 minutes ─────────
cron.schedule("*/15 * * * *", async () => {
  try {
    const icsService = new IcsCalendarService();
    const result = await icsService.syncAll();
    if (result.synced > 0) {
      console.log(`[Worker] Synced ${result.synced} ICS calendar(s)`);
    }
  } catch (err) {
    console.error("[Worker] ICS calendar sync error:", err);
  }
});

// Keep alive
setInterval(() => {}, 60000);
