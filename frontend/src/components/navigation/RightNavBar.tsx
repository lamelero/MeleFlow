import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

const tabs: { path: string; labelKey: string; icon: ReactNode; activeIcon: ReactNode }[] = [
  {
    path: "/app?view=tasks",
    labelKey: "bottomNav.tasks",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
    activeIcon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  },
  {
    path: "/app?view=habits",
    labelKey: "bottomNav.habits",
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    activeIcon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  },
  {
    path: "/app?view=calendar",
    labelKey: "bottomNav.calendar",
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    activeIcon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  },
  {
    path: "/app/timer",
    labelKey: "bottomNav.timer",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    activeIcon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  },
];

export default function RightNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    if (path === "/app?view=tasks") return location.search === "?view=tasks" || (location.pathname === "/app" && location.search !== "?view=calendar" && location.search !== "?view=habits");
    if (path === "/app?view=habits") return location.search === "?view=habits";
    if (path === "/app?view=calendar") return location.search === "?view=calendar";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed right-0 top-0 z-50 flex flex-col items-center gap-4 border-l border-gray-200/80 bg-white/90 backdrop-blur-lg dark:border-gray-800/80 dark:bg-gray-900/90"
      style={{
        width: "60px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "100dvh",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex items-center justify-center rounded-xl p-2.5 transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              }`}
              title={t(tab.labelKey)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
                {active ? tab.activeIcon : tab.icon}
              </svg>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
