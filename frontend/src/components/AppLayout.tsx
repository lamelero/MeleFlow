import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PomodoroTimer from "./pomodoro/PomodoroTimer";
import UserMenu from "./UserMenu";
import BottomTabBar from "./navigation/BottomTabBar";
import { useBrandingStore } from "../store/brandingStore";
import { useThemeStore } from "../store/themeStore";
import { isNative } from "../capacitor/register";

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { logoUrl, logoUrlDark, fetchLogo } = useBrandingStore();
  const { theme } = useThemeStore();
  const activeLogo = theme === "dark" && logoUrlDark ? logoUrlDark : logoUrl;

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  return (
    <div className="flex min-h-screen flex-col" style={isNative() ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" } : undefined}>
      <header
        className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="no-underline">
              <div className="flex items-center gap-2">
                <img src="/meleflow-logo.svg" alt="" className="h-6 w-6" />
                {activeLogo ? (
                  <img src={activeLogo} alt={t("common.logoAlt")} className="h-8 w-auto" />
                ) : (
                  <span className="font-outfit text-xl font-bold text-primary">{t("auth.taskflow")}</span>
                )}
              </div>
            </Link>
            {title && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {title}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <PomodoroTimer />
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      {isNative() && <BottomTabBar />}
    </div>
  );
}
