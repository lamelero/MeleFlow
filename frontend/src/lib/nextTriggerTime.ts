function parseTime(timeStr: string | undefined | null): { hour: number; minute: number } | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { hour: h, minute: m };
}

function nextDaily(hour: number, minute: number, dueDate?: Date | null): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (dueDate && next > dueDate) return dueDate;
  return next;
}

function nextWeekly(hour: number, minute: number, days: number[], dueDate?: Date | null): Date | null {
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute, 0, 0);
    if (next <= now) continue;
    const uiIdx = next.getDay() === 0 ? 6 : next.getDay() - 1;
    if (days.includes(uiIdx)) {
      if (dueDate && next > dueDate) return dueDate;
      return next;
    }
  }
  return null;
}

function nextBeforeDue(hour: number, minute: number, beforeDays: number, dueDate: Date): Date | null {
  const at = new Date(dueDate.getTime() - beforeDays * 86400000);
  at.setHours(hour, minute, 0, 0);
  return at > new Date() ? at : null;
}

export function getNextTrigger(reminderConfig: string | null | undefined, dueDateStr?: string | null): Date | null {
  if (!reminderConfig) return null;
  try {
    const parsed = JSON.parse(reminderConfig);
    const items: { time: string; frequency: string; days?: number[]; beforeDays?: number }[] = Array.isArray(parsed)
      ? parsed
      : parsed?.type && parsed?.reminderTime
        ? parsed.type === "daily"
          ? [{ time: parsed.reminderTime, frequency: "always" }]
          : parsed.type === "weekly" && parsed.days?.length
            ? [{ time: parsed.reminderTime, frequency: "weekly", days: parsed.days }]
            : []
        : [];

    const due = dueDateStr ? new Date(dueDateStr) : null;
    let earliest: Date | null = null;

    for (const item of items) {
      const t = parseTime(item.time);
      if (!t) continue;
      let next: Date | null = null;
      if (item.frequency === "always") {
        next = nextDaily(t.hour, t.minute, due);
      } else if (item.frequency === "weekly" && item.days?.length) {
        next = nextWeekly(t.hour, t.minute, item.days, due);
      } else if (item.frequency === "before_due" && due) {
        next = nextBeforeDue(t.hour, t.minute, item.beforeDays ?? 0, due);
      }
      if (next && (!earliest || next < earliest)) earliest = next;
    }
    return earliest;
  } catch {
    return null;
  }
}

export function formatNextTrigger(date: Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabel = days[date.getDay()];
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffMs < 0) return `PAST (${dayLabel} ${timeStr})`;
  if (diffMin < 60) return `${dayLabel} ${timeStr} (in ${diffMin}m)`;
  if (diffMin < 1440) return `${dayLabel} ${timeStr} (in ${Math.round(diffMin / 60)}h)`;
  return `${dayLabel} ${timeStr} (in ${Math.round(diffMin / 1440)}d)`;
}
