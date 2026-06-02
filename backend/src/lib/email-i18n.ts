interface EmailTranslation {
  taskSubject: string;
  habitSubject: string;
  headerTitle: string;
  greeting: string;
  taskBody: string;
  habitBody: string;
  dueLabel: string;
  cta: string;
  footerTagline: string;
  footerBrand: string;
  streakBadge: string;
}

const translations: Record<string, EmailTranslation> = {
  en: {
    taskSubject: 'Reminder: "{{title}}" is due soon',
    habitSubject: 'Habit reminder: "{{name}}"',
    headerTitle: "Reminder",
    greeting: "Hi <strong>{{username}}</strong>,",
    taskBody: "This is a friendly reminder about your upcoming task:",
    habitBody: "Time for your daily habit!",
    dueLabel: "Due:",
    cta: "Open MeleNotes",
    footerTagline: "Stay productive! ✨",
    footerBrand: "MeleNotes &mdash; Self-hosted task management",
    streakBadge: "🔥 {{count}} day streak",
  },
  es: {
    taskSubject: 'Recordatorio: "{{title}}" vence pronto',
    habitSubject: 'Recordatorio de hábito: "{{name}}"',
    headerTitle: "Recordatorio",
    greeting: "Hola <strong>{{username}}</strong>,",
    taskBody: "Este es un recordatorio de tu tarea próxima:",
    habitBody: "¡Hora de tu hábito diario!",
    dueLabel: "Vence:",
    cta: "Abrir MeleNotes",
    footerTagline: "¡Mantente productivo! ✨",
    footerBrand: "MeleNotes &mdash; Gestión de tareas auto-gestionada",
    streakBadge: "🔥 {{count}} días seguidos",
  },
};

export function t(lang: string, key: keyof EmailTranslation): string {
  return translations[lang]?.[key] ?? translations.en[key];
}

export function formatDate(dateStr: string, lang: string): string {
  if (!dateStr) return "";
  const locale = lang === "es" ? "es-ES" : "en-US";
  return new Date(dateStr).toLocaleString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
