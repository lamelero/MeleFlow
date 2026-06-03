import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PomodoroTimer from "./pomodoro/PomodoroTimer";
import UserMenu from "./UserMenu";
import { useBrandingStore } from "../store/brandingStore";

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { logoUrl, fetchLogo } = useBrandingStore();

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="no-underline">
              {logoUrl ? (
                <img src={logoUrl} alt={t("common.logoAlt")} className="h-8 w-auto" />
              ) : (
                <span className="font-outfit text-xl font-bold text-primary">{t("auth.taskflow")}</span>
              )}
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
      {children}
    </div>
  );
}
