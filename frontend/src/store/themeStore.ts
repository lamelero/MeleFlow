import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  if (typeof window !== "undefined") {
    applyTheme(initial);
  }

  return {
    theme: initial,
    toggleTheme: () => {
      const next = get().theme === "light" ? "dark" : "light";
      applyTheme(next);
      set({ theme: next });
    },
    setTheme: (theme: Theme) => {
      applyTheme(theme);
      set({ theme });
    },
  };
});
