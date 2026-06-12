export interface ParsedTask {
  title: string;
  dueDate?: string;
  tags?: string[];
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, lunes: 1,
  tuesday: 2, martes: 2,
  wednesday: 3, miércoles: 3, miercoles: 3,
  thursday: 4, jueves: 4,
  friday: 5, viernes: 5,
  saturday: 6, sábado: 6, sabado: 6,
};

function nextWeekday(name: string): Date {
  const target = DAY_NAMES[name.toLowerCase()];
  if (target === undefined) return null as unknown as Date;
  const now = new Date();
  const today = now.getDay();
  let diff = target - today;
  if (diff <= 0) diff += 7;
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function handleNextWeekday(name: string, forceNext: boolean): Date {
  const target = DAY_NAMES[name.toLowerCase()];
  if (target === undefined) return null as unknown as Date;
  const now = new Date();
  const today = now.getDay();
  let diff = target - today;
  if (forceNext) {
    if (diff <= 0) diff += 7;
  } else {
    if (diff < 0) diff += 7;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseTaskInput(text: string): ParsedTask {
  let title = text.trim();
  let dueDate: string | undefined;
  const tags: string[] = [];

  // Extract #tags
  title = title.replace(/#(\w+)/g, (_, tag) => {
    tags.push(tag);
    return "";
  }).replace(/\s+/g, " ").trim();

  // Extract date/time patterns
  const patterns: { regex: RegExp; handler: (match: RegExpMatchArray) => Date | null }[] = [
    {
      regex: /pasado mañana|pasado manana/i,
      handler: () => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      regex: /mañana|manana/i,
      handler: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
    {
      regex: /\bel\s+(próximo|proximo|próxima|proxima|este)\s+(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (m) => handleNextWeekday(m[2], true),
    },
    {
      regex: /\b(próximo|proximo|próxima|proxima|este)\s+(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (m) => handleNextWeekday(m[2], m[1].toLowerCase().startsWith("pró") || m[1].toLowerCase().startsWith("pro")),
    },
    {
      regex: /\bel\s+(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (m) => nextWeekday(m[1]),
    },
    {
      regex: /en (\d+) (d[ií]a|dia|d[ií]as|dias|semana|semanas)/i,
      handler: (m) => {
        const num = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        const d = new Date();
        if (unit.startsWith("d")) d.setDate(d.getDate() + num);
        else d.setDate(d.getDate() + num * 7);
        d.setHours(0, 0, 0, 0);
        return d;
      },
    },
  ];

  for (const { regex, handler } of patterns) {
    const match = title.match(regex);
    if (match) {
      const date = handler(match);
      if (date) {
        dueDate = date.toISOString();
        title = title.replace(match[0], "").replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  // Extract time "a las HH:MM" or "a las HH"
  const timeMatch = title.match(/a\s*las?\s*(\d{1,2})(?::(\d{2}))?/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || "0", 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      if (dueDate) {
        const d = new Date(dueDate);
        d.setHours(hours, minutes, 0, 0);
        dueDate = d.toISOString();
      } else {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 1);
        dueDate = d.toISOString();
      }
      title = title.replace(timeMatch[0], "").replace(/\s+/g, " ").trim();
    }
  }

  // Extract "hoy" if no time found but "hoy" mentioned
  const hoyMatch = title.match(/\bhoy\b/i);
  if (hoyMatch && !dueDate) {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    dueDate = d.toISOString();
    title = title.replace(hoyMatch[0], "").replace(/\s+/g, " ").trim();
  }

  return { title: title || text.trim(), dueDate, tags };
}
