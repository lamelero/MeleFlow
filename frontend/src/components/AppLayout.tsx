import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PomodoroTimer from "./pomodoro/PomodoroTimer";
import UserMenu from "./UserMenu";
import BottomTabBar from "./navigation/BottomTabBar";
import RightNavBar from "./navigation/RightNavBar";
import { useBrandingStore } from "../store/brandingStore";
import { useThemeStore } from "../store/themeStore";
import { isNative } from "../capacitor/register";
import { resolveImageUrl } from "../api/client";
import { useOrientation } from "../lib/useOrientation";

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { logoUrl, logoUrlDark, fetchLogo } = useBrandingStore();
  const { theme } = useThemeStore();
  const activeLogo = theme === "dark" && logoUrlDark ? resolveImageUrl(logoUrlDark) : resolveImageUrl(logoUrl);
  const orientation = useOrientation();
  const isLandscape = isNative() && orientation === "landscape";

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  const navStyle = isNative()
    ? isLandscape
      ? { paddingRight: "calc(60px + env(safe-area-inset-right, 0px))" }
      : { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }
    : undefined;

  return (
    <div className="flex h-screen flex-col" style={navStyle}>
      <header
        className="sticky top-0 z-10 shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/80"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="no-underline">
              <div className="flex items-center gap-2">
                {activeLogo ? (
                  <img src={activeLogo} alt={t("common.logoAlt")} className="h-8 w-auto" />
                ) : (
                  <>
                    <img src="/meleflow-logo.svg" alt="" className="h-6 w-6" />
                    <span className="font-outfit text-xl font-bold text-primary">{t("auth.taskflow")}</span>
                  </>
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
            {!isNative() && <PomodoroTimer />}
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      <div className={`flex items-center justify-center gap-1 opacity-40 ${isLandscape ? "py-1" : "py-2"}`}>
        <img src="/meleflow-logo.svg" alt="" className="h-3 w-3" />
        <span className="text-xs text-gray-400 dark:text-gray-400">MeleFlow</span>
      </div>
      {isNative() && (isLandscape ? <RightNavBar /> : <BottomTabBar />)}
    </div>
  );
}
