import type { ReactNode } from "react";

export interface HabitCategoryInfo {
  label: string;
  labelEs: string;
  icon: () => ReactNode;
  color: string;
  bgColor: string;
}

const S = { strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const W = { width: 20, height: 20 };

export const HABIT_CATEGORIES: Record<string, HabitCategoryInfo> = {
  DEJAR_HABITO: {
    label: "Quit Habit",
    labelEs: "Dejar Hábito",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </svg>
    ),
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  ARTE: {
    label: "Art",
    labelEs: "Arte",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ),
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.12)",
  },
  TAREA: {
    label: "Task",
    labelEs: "Tarea",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="12" cy="12" r="9" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    color: "#10B981",
    bgColor: "rgba(16,185,129,0.12)",
  },
  MEDITACION: {
    label: "Meditation",
    labelEs: "Meditación",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="12" cy="4" r="2" />
        <path d="M8 12c3 1 5 1 8 0" />
        <path d="M6 9.5c4-1.5 8-1.5 12 0" />
        <path d="M7 19c2-1.5 4-2 5-2s3 .5 5 2" />
        <path d="M12 14v6" />
      </svg>
    ),
    color: "#8B5CF6",
    bgColor: "rgba(139,92,246,0.12)",
  },
  ESTUDIO: {
    label: "Study",
    labelEs: "Estudio",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
        <path d="M12 2v20" />
        <line x1="8" y1="13" x2="10" y2="13" />
        <line x1="8" y1="16" x2="14" y2="16" />
      </svg>
    ),
    color: "#3B82F6",
    bgColor: "rgba(59,130,246,0.12)",
  },
  TRABAJO: {
    label: "Work",
    labelEs: "Trabajo",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="12" x2="12" y2="21" />
      </svg>
    ),
    color: "#6366F1",
    bgColor: "rgba(99,102,241,0.12)",
  },
  DEPORTE: {
    label: "Sports",
    labelEs: "Deporte",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="17" cy="4" r="2" />
        <path d="M15.59 5.41 9 12" />
        <path d="m11 10 2 3 3 2 3 2" />
        <path d="M8 14l3 3 1 4" />
      </svg>
    ),
    color: "#14B8A6",
    bgColor: "rgba(20,184,166,0.12)",
  },
  ENTRETENIMIENTO: {
    label: "Entertainment",
    labelEs: "Entretenimiento",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <rect x="3" y="7" width="18" height="13" rx="3" />
        <polygon points="10 10 16 13.5 10 17" />
        <line x1="3" y1="14" x2="5" y2="14" />
        <line x1="19" y1="14" x2="21" y2="14" />
      </svg>
    ),
    color: "#EC4899",
    bgColor: "rgba(236,72,153,0.12)",
  },
  SOCIAL: {
    label: "Social",
    labelEs: "Social",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="9" cy="7" r="3" />
        <circle cx="17" cy="7.5" r="2.5" />
        <path d="M4 21v-2a4 4 0 0 1 4-4h2" />
        <path d="M14 15h2a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    color: "#F97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  FINANZAS: {
    label: "Finances",
    labelEs: "Finanzas",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M3 3v18h18" />
        <polyline points="7 17 11 12 15 14 21 8" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    color: "#22C55E",
    bgColor: "rgba(34,197,94,0.12)",
  },
  SALUD: {
    label: "Health",
    labelEs: "Salud",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M19 14c2-2 3-4.5 3-7C22 4.5 20 2 17 2c-2 0-3.5 1-5 2.5C10.5 3 9 2 7 2 4 2 2 4.5 2 7c0 2.5 1 5 3 7l7 7 7-7Z" />
      </svg>
    ),
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  NUTRICION: {
    label: "Nutrition",
    labelEs: "Nutrición",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="12" cy="14" r="8" />
        <path d="M12 6V4c0-1 2-1 2 0v2" />
        <path d="M10 5c1 .7 2 .7 2 .7s1 0 2-.7" />
        <path d="M14 14c-1 2-3 2-4 0" />
        <line x1="12" y1="6" x2="12" y2="8" />
      </svg>
    ),
    color: "#84CC16",
    bgColor: "rgba(132,204,22,0.12)",
  },
  HOGAR: {
    label: "Home",
    labelEs: "Hogar",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M3 10 12 2l9 8" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.12)",
  },
  AIRE_LIBRE: {
    label: "Outdoor",
    labelEs: "Aire Libre",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <path d="M2 20 9 8l5 7 3-4 5 9H2Z" />
        <path d="M2 20h20" />
        <circle cx="17" cy="5" r="2" />
      </svg>
    ),
    color: "#059669",
    bgColor: "rgba(5,150,105,0.12)",
  },
  OTROS: {
    label: "Other",
    labelEs: "Otros",
    icon: () => (
      <svg viewBox="0 0 24 24" {...S} {...W} stroke="currentColor">
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    color: "#6B7280",
    bgColor: "rgba(107,114,128,0.12)",
  },
};

export const HABIT_CATEGORY_KEYS = Object.keys(HABIT_CATEGORIES);
