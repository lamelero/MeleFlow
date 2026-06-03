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
  taskRecurringSubject: string;
  taskRecurringBody: string;
  taskSharedSubject: string;
  taskSharedBody: string;
  otpSubject: string;
  otpBody: string;
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
    cta: "Open MeleFlow",
    footerTagline: "Stay productive! ✨",
    footerBrand: "MeleFlow &mdash; Self-hosted task management",
    streakBadge: "🔥 {{count}} day streak",
    taskRecurringSubject: "Recurring reminder: '{{title}}'",
    taskRecurringBody: "Time to work on your task!",
    taskSharedSubject: "{{inviter}} shared a task with you",
    taskSharedBody: "{{inviter}} has shared the task \"{{title}}\" with you on MeleFlow.",
    otpSubject: "Your login code",
    otpBody: "Your verification code is: <strong>{{code}}</strong>. It expires in 10 minutes.",
  },
  es: {
    taskSubject: 'Recordatorio: "{{title}}" vence pronto',
    habitSubject: 'Recordatorio de hábito: "{{name}}"',
    headerTitle: "Recordatorio",
    greeting: "Hola <strong>{{username}}</strong>,",
    taskBody: "Este es un recordatorio de tu tarea próxima:",
    habitBody: "¡Hora de tu hábito diario!",
    dueLabel: "Vence:",
    cta: "Abrir MeleFlow",
    footerTagline: "¡Mantente productivo! ✨",
    footerBrand: "MeleFlow &mdash; Gestión de tareas auto-gestionada",
    streakBadge: "🔥 {{count}} días seguidos",
    taskRecurringSubject: "Recordatorio recurrente: '{{title}}'",
    taskRecurringBody: "¡Hora de trabajar en tu tarea!",
    taskSharedSubject: "{{inviter}} compartió una tarea contigo",
    taskSharedBody: "{{inviter}} ha compartido la tarea \"{{title}}\" contigo en MeleFlow.",
    otpSubject: "Tu código de inicio de sesión",
    otpBody: "Tu código de verificación es: <strong>{{code}}</strong>. Expira en 10 minutos.",
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
