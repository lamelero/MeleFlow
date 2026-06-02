export interface CategoryIcon {
  svg: string;
  symbol: string;
  color: string;
}

function icon(paths: string, color: string, symbol: string): CategoryIcon {
  return {
    svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
    symbol,
    color,
  };
}

export const CATEGORY_ICONS: Record<string, CategoryIcon> = {
  DEJAR_HABITO: icon('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>', "#EF4444", "✕"),
  ARTE: icon('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/>', "#F59E0B", "✦"),
  TAREA: icon('<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>', "#10B981", "✓"),
  MEDITACION: icon('<circle cx="12" cy="4" r="2"/><path d="M8 12c3 1 5 1 8 0"/><path d="M6 9.5c4-1.5 8-1.5 12 0"/><path d="M7 19c2-1.5 4-2 5-2s3 .5 5 2"/><path d="M12 14v6"/>', "#8B5CF6", "◌"),
  ESTUDIO: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="M12 2v20"/><line x1="8" y1="13" x2="10" y2="13"/><line x1="8" y1="16" x2="14" y2="16"/>', "#3B82F6", "✎"),
  TRABAJO: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="12" x2="12" y2="21"/>', "#6366F1", "⚑"),
  DEPORTE: icon('<circle cx="17" cy="4" r="2"/><path d="M15.59 5.41 9 12"/><path d="m11 10 2 3 3 2 3 2"/><path d="M8 14l3 3 1 4"/>', "#14B8A6", "★"),
  ENTRETENIMIENTO: icon('<rect x="3" y="7" width="18" height="13" rx="3"/><polygon points="10 10 16 13.5 10 17"/><line x1="3" y1="14" x2="5" y2="14"/><line x1="19" y1="14" x2="21" y2="14"/>', "#EC4899", "▶"),
  SOCIAL: icon('<circle cx="9" cy="7" r="3"/><circle cx="17" cy="7.5" r="2.5"/><path d="M4 21v-2a4 4 0 0 1 4-4h2"/><path d="M14 15h2a4 4 0 0 1 4 4v2"/>', "#F97316", "♥"),
  FINANZAS: icon('<path d="M3 3v18h18"/><polyline points="7 17 11 12 15 14 21 8"/><circle cx="12" cy="12" r="1" fill="currentColor"/>', "#22C55E", "$"),
  SALUD: icon('<path d="M19 14c2-2 3-4.5 3-7C22 4.5 20 2 17 2c-2 0-3.5 1-5 2.5C10.5 3 9 2 7 2 4 2 2 4.5 2 7c0 2.5 1 5 3 7l7 7 7-7Z"/>', "#EF4444", "✚"),
  NUTRICION: icon('<circle cx="12" cy="14" r="8"/><path d="M12 6V4c0-1 2-1 2 0v2"/><path d="M10 5c1 .7 2 .7 2 .7s1 0 2-.7"/><path d="M14 14c-1 2-3 2-4 0"/><line x1="12" y1="6" x2="12" y2="8"/>', "#84CC16", "✿"),
  HOGAR: icon('<path d="M3 10 12 2l9 8"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>', "#A855F7", "⌂"),
  AIRE_LIBRE: icon('<path d="M2 20 9 8l5 7 3-4 5 9H2Z"/><path d="M2 20h20"/><circle cx="17" cy="5" r="2"/>', "#059669", "▲"),
  OTROS: icon('<circle cx="7" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="17" cy="12" r="1.5" fill="currentColor"/>', "#6B7280", "●"),
};

export const TASK_ICON = icon('<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>', "#14B8A6", "✓");

export function getCategoryIcon(category: string | null): CategoryIcon {
  if (category && CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  return CATEGORY_ICONS.OTROS;
}
