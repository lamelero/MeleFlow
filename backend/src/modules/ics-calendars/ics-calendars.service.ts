import rrulePkg from "rrule";
const { RRule } = rrulePkg;
import { prisma } from "../../config/database";
import type { CreateIcsCalendarInput, UpdateIcsCalendarInput } from "./ics-calendars.schema";

interface ParsedEvent {
  externalId: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location: string | null;
}

export class IcsCalendarService {
  async findAll(userId: string) {
    return prisma.icsCalendar.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, input: CreateIcsCalendarInput) {
    const calendar = await prisma.icsCalendar.create({
      data: {
        userId,
        name: input.name,
        url: input.url,
        color: input.color,
        reminderBefore: input.reminderBefore ?? 0,
        allDayReminderTime: input.allDayReminderTime ?? "09:00",
      },
    });
    return calendar;
  }

  async update(userId: string, id: string, input: UpdateIcsCalendarInput) {
    const cal = await prisma.icsCalendar.findFirst({
      where: { id, userId },
    });
    if (!cal) throw new Error("Calendar not found");
    return prisma.icsCalendar.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.reminderBefore !== undefined && { reminderBefore: input.reminderBefore }),
        ...(input.allDayReminderTime !== undefined && { allDayReminderTime: input.allDayReminderTime }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const cal = await prisma.icsCalendar.findFirst({
      where: { id, userId },
    });
    if (!cal) throw new Error("Calendar not found");
    await prisma.icsEvent.deleteMany({ where: { icsCalendarId: id } });
    await prisma.icsCalendar.delete({ where: { id } });
  }

  async sync(userId: string, id: string) {
    const cal = await prisma.icsCalendar.findFirst({
      where: { id, userId },
    });
    if (!cal) throw new Error("Calendar not found");

    const events = await this.fetchAndParse(cal.url, cal.id, userId);

    // Delete old events for this calendar
    await prisma.icsEvent.deleteMany({ where: { icsCalendarId: id } });

    // Bulk insert new events
    if (events.length > 0) {
      await prisma.icsEvent.createMany({
        data: events.map((e) => ({
          ...e,
          icsCalendarId: id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.icsCalendar.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });

    return { count: events.length };
  }

  async getEvents(
    userId: string,
    from?: string,
    to?: string,
  ) {
    const where: Record<string, unknown> = { userId };

    if (from || to) {
      where.startTime = {};
      if (from) (where.startTime as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startTime as Record<string, unknown>).lte = new Date(to);
    }

    return prisma.icsEvent.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        icsCalendar: {
          select: { name: true, color: true, reminderBefore: true, allDayReminderTime: true },
        },
      },
    });
  }

  private async fetchAndParse(
    url: string,
    icsCalendarId: string,
    userId: string,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "MeleFlow/1.0",
          Accept: "text/calendar",
        },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Failed to fetch ICS: ${response.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
      }
      const content = await response.text();
      return this.parseIcs(content, icsCalendarId, userId);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseIcs(
    content: string,
    icsCalendarId: string,
    userId: string,
  ): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    const now = new Date();
    const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Split into VEVENT blocks
    const veventBlocks = this.extractVeventBlocks(content);

    for (const block of veventBlocks) {
      try {
        const uid = this.extractProperty(block, "UID") || crypto.randomUUID();
        const summary = this.extractProperty(block, "SUMMARY") || "Untitled";
        const description = this.extractProperty(block, "DESCRIPTION");
        const location = this.extractProperty(block, "LOCATION");

        const dtstartStr = this.extractPropertyWithParams(block, "DTSTART");
        const dtendStr = this.extractPropertyWithParams(block, "DTEND");
        const rruleStr = this.extractProperty(block, "RRULE");

        if (!dtstartStr) continue;

        const dtstart = this.parseIcsDate(dtstartStr.value, dtstartStr.params);
        const dtend = dtendStr
          ? this.parseIcsDate(dtendStr.value, dtendStr.params)
          : new Date(dtstart.getTime() + 3600000);
        const isAllDay = dtstartStr.params ? dtstartStr.params.includes("VALUE=DATE") : false;

        if (rruleStr) {
          const instances = this.expandRrule(
            rruleStr,
            dtstart,
            dtend.getTime() - dtstart.getTime(),
            windowStart,
            windowEnd,
          );
          for (const inst of instances) {
            events.push({
              externalId: `${uid}-${inst.start.toISOString()}`,
              title: summary,
              description,
              startTime: inst.start,
              endTime: inst.end,
              isAllDay,
              location,
            });
          }
        } else {
          events.push({
            externalId: uid,
            title: summary,
            description,
            startTime: dtstart,
            endTime: dtend,
            isAllDay,
            location,
          });
        }
      } catch {
        // skip malformed events
      }
    }

    return events;
  }

  private extractVeventBlocks(content: string): string[] {
    const blocks: string[] = [];
    const lines = content.split(/\r?\n/);
    let inVevent = false;
    let current: string[] = [];

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        inVevent = true;
        current = [line];
      } else if (line === "END:VEVENT") {
        if (inVevent) {
          current.push(line);
          blocks.push(current.join("\n"));
          inVevent = false;
        }
      } else if (inVevent) {
        current.push(line);
      }
    }
    return blocks;
  }

  private extractProperty(block: string, name: string): string | null {
    const regex = new RegExp(
      `^${name}(?:;[^:]*)?:(.+)$`,
      "im",
    );
    const match = block.match(regex);
    if (!match) return null;

    let value = match[1].trim();
    // Unfold lines (folded lines start with space/tab)
    value = value.replace(/\r?\n[ \t]/g, "");
    // Unescape \\n, \\N, \\, etc
    value = value.replace(/\\\\n/g, "\n").replace(/\\\\N/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, "\n").replace(/\\N/g, "\n");
    return value || null;
  }

  private extractPropertyWithParams(
    block: string,
    name: string,
  ): { value: string; params: string | null } | null {
    const regex = new RegExp(`^${name}((?:;[^:]*)?):(.+)$`, "im");
    const match = block.match(regex);
    if (!match) return null;
    return {
      params: match[1] ? match[1].slice(1) : null,
      value: match[2].trim(),
    };
  }

  private parseIcsDate(
    value: string,
    params: string | null,
  ): Date {
    // VALUE=DATE -> all-day: YYYYMMDD (midnight UTC)
    if (value.length === 8 && /^\d{8}$/.test(value)) {
      const year = parseInt(value.slice(0, 4));
      const month = parseInt(value.slice(4, 6)) - 1;
      const day = parseInt(value.slice(6, 8));
      return new Date(Date.UTC(year, month, day));
    }

    // UTC: YYYYMMDDTHHMMSSZ
    if (value.endsWith("Z") && value.length >= 16) {
      const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}${value.slice(15)}`;
      return new Date(iso);
    }

    // Local time: YYYYMMDDTHHMMSS (no timezone) or with TZID
    let dateStr = value;
    if (dateStr.length >= 15) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const hour = dateStr.slice(9, 11);
      const min = dateStr.slice(11, 13);
      const sec = dateStr.slice(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
    }

    return new Date(value);
  }

  private expandRrule(
    rruleStr: string,
    dtstart: Date,
    durationMs: number,
    windowStart: Date,
    windowEnd: Date,
  ): { start: Date; end: Date }[] {
    try {
      const dtstartIso = dtstart.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const ruleString = `DTSTART:${dtstartIso}\nRRULE:${rruleStr}`;
      const rule = RRule.fromString(ruleString);
      const instances = rule.between(windowStart, windowEnd, true);
      return instances.map((d: Date) => ({
        start: d,
        end: new Date(d.getTime() + durationMs),
      }));
    } catch {
      return [{ start: dtstart, end: new Date(dtstart.getTime() + durationMs) }];
    }
  }

  // Sync all active calendars (called from worker)
  async syncAll() {
    const calendars = await prisma.icsCalendar.findMany({
      where: { isActive: true },
    });

    for (const cal of calendars) {
      try {
        await this.sync(cal.userId, cal.id);
        console.log(`[IcsCalendar] Synced "${cal.name}" (${cal.id})`);
      } catch (err) {
        console.error(`[IcsCalendar] Failed to sync "${cal.name}":`, err);
      }
    }

    return { synced: calendars.length };
  }
}
