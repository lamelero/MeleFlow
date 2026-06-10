import type { ReactNode } from "react";
import {
  Ban, Palette, CheckSquare, Brain, BookOpen, Briefcase,
  Dumbbell, Clapperboard, Users, DollarSign, Heart, Utensils,
  Home, Mountain, Circle,
} from "lucide-react";

export interface HabitCategoryInfo {
  label: string;
  labelEs: string;
  icon: () => ReactNode;
  color: string;
  bgColor: string;
}

function IconComp(Icon: typeof Ban) {
  return () => <Icon size={20} strokeWidth={1.5} />;
}

export const HABIT_CATEGORIES: Record<string, HabitCategoryInfo> = {
  DEJAR_HABITO: {
    label: "Quit Habit",
    labelEs: "Dejar Hábito",
    icon: IconComp(Ban),
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  ARTE: {
    label: "Art",
    labelEs: "Arte",
    icon: IconComp(Palette),
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.12)",
  },
  TAREA: {
    label: "Task",
    labelEs: "Tarea",
    icon: IconComp(CheckSquare),
    color: "#10B981",
    bgColor: "rgba(16,185,129,0.12)",
  },
  MEDITACION: {
    label: "Meditation",
    labelEs: "Meditación",
    icon: IconComp(Brain),
    color: "#8B5CF6",
    bgColor: "rgba(139,92,246,0.12)",
  },
  ESTUDIO: {
    label: "Study",
    labelEs: "Estudio",
    icon: IconComp(BookOpen),
    color: "#3B82F6",
    bgColor: "rgba(59,130,246,0.12)",
  },
  TRABAJO: {
    label: "Work",
    labelEs: "Trabajo",
    icon: IconComp(Briefcase),
    color: "#6366F1",
    bgColor: "rgba(99,102,241,0.12)",
  },
  DEPORTE: {
    label: "Sports",
    labelEs: "Deporte",
    icon: IconComp(Dumbbell),
    color: "#14B8A6",
    bgColor: "rgba(20,184,166,0.12)",
  },
  ENTRETENIMIENTO: {
    label: "Entertainment",
    labelEs: "Entretenimiento",
    icon: IconComp(Clapperboard),
    color: "#EC4899",
    bgColor: "rgba(236,72,153,0.12)",
  },
  SOCIAL: {
    label: "Social",
    labelEs: "Social",
    icon: IconComp(Users),
    color: "#F97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  FINANZAS: {
    label: "Finances",
    labelEs: "Finanzas",
    icon: IconComp(DollarSign),
    color: "#22C55E",
    bgColor: "rgba(34,197,94,0.12)",
  },
  SALUD: {
    label: "Health",
    labelEs: "Salud",
    icon: IconComp(Heart),
    color: "#EF4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  NUTRICION: {
    label: "Nutrition",
    labelEs: "Nutrición",
    icon: IconComp(Utensils),
    color: "#84CC16",
    bgColor: "rgba(132,204,22,0.12)",
  },
  HOGAR: {
    label: "Home",
    labelEs: "Hogar",
    icon: IconComp(Home),
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.12)",
  },
  AIRE_LIBRE: {
    label: "Outdoor",
    labelEs: "Aire Libre",
    icon: IconComp(Mountain),
    color: "#059669",
    bgColor: "rgba(5,150,105,0.12)",
  },
  OTROS: {
    label: "Other",
    labelEs: "Otros",
    icon: IconComp(Circle),
    color: "#6B7280",
    bgColor: "rgba(107,114,128,0.12)",
  },
};

export const HABIT_CATEGORY_KEYS = Object.keys(HABIT_CATEGORIES);
