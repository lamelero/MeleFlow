import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import i18n from "./i18n";
import Login from "./views/auth/Login";
import Register from "./views/auth/Register";
import TwoFactorVerify from "./views/auth/TwoFactorVerify";
import Dashboard from "./views/app/Dashboard";
import HabitDetail from "./views/app/HabitDetail";
import Statistics from "./views/app/Statistics";
import TimerView from "./views/app/TimerView";
import Profile from "./views/app/Profile";
import AdminPanel from "./views/app/AdminPanel";
import TagManager from "./views/app/TagManager";
import ProtectedRoute from "./components/ProtectedRoute";
import ServerConfig from "./components/ServerConfig";
import { isNative, getServerUrl, setupAppListeners, setupStatusBar, getFontSize, getBoldFont, requestNotificationPermission, createNotificationChannel, requestExactAlarmPermission } from "./capacitor/register";
import { requestBrowserPermission } from "./lib/browserNotifications";
import { registerPushNotifications } from "./capacitor/pushNotifications";
import { useThemeStore } from "./store/themeStore";
import { initClientBaseUrl } from "./api/client";
import "./i18n";

export default function App() {
  const location = useLocation();
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const [ready, setReady] = useState(false);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [fontSize, setFontSize] = useState("normal");
  const [boldFont, setBoldFontState] = useState(false);

  useEffect(() => {
    async function init() {
      if (isNative()) {
        setupAppListeners();
        await initClientBaseUrl();
        const url = await getServerUrl();
        const size = await getFontSize();
        setFontSize(size);
        document.documentElement.style.fontSize =
          size === "small" ? "14px" :
          size === "large" ? "18px" :
          size === "xlarge" ? "20px" :
          "16px";
        const bold = await getBoldFont();
        setBoldFontState(bold);
        document.documentElement.style.fontWeight = bold ? "600" : "";
        if (!url) {
          setNeedsConfig(true);
          setReady(true);
          return;
        }
      }
      await initialize();
      if (isNative()) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await createNotificationChannel();
          await requestExactAlarmPermission();
        } else {
          console.warn("[notifications] permission denied by user");
        }
        try {
          await registerPushNotifications();
        } catch (err) {
          console.error("[app] push registration failed:", err);
        }
      } else {
        requestBrowserPermission();
      }
      setReady(true);
    }
    init();
  }, [initialize]);

  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    setupStatusBar(theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  const sizeClass =
    fontSize === "small" ? "text-sm" :
    fontSize === "large" ? "text-lg" :
    fontSize === "xlarge" ? "text-xl" :
    "text-base";

  if (!ready) return null;

  if (needsConfig) {
    return (
      <ServerConfig
        onConfigured={() => {
          initClientBaseUrl().then(() => {
            setNeedsConfig(false);
            initialize();
          });
        }}
      />
    );
  }

  return (
    <div className={sizeClass}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "12px",
            fontFamily: "Urbanist, sans-serif",
            fontSize: "14px",
          },
        }}
      />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/login/2fa" element={<TwoFactorVerify />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/calendar"
            element={<Navigate to="/app?view=calendar" replace />}
          />
          <Route
            path="/app/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ProtectedRoute>
                <TagManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/habits"
            element={<Navigate to="/app?view=habits" replace />}
          />
          <Route
            path="/app/habits/:id"
            element={
              <ProtectedRoute>
                <HabitDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/statistics"
            element={
              <ProtectedRoute>
                <Statistics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/timer"
            element={
              <ProtectedRoute>
                <TimerView />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
