import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import i18n from "./i18n";
// Route-level code splitting: each view is downloaded on first visit.
const Login = lazy(() => import("./views/auth/Login"));
const Register = lazy(() => import("./views/auth/Register"));
const TwoFactorVerify = lazy(() => import("./views/auth/TwoFactorVerify"));
const Dashboard = lazy(() => import("./views/app/Dashboard"));
const HabitDetail = lazy(() => import("./views/app/HabitDetail"));
const Statistics = lazy(() => import("./views/app/Statistics"));
const TimerView = lazy(() => import("./views/app/TimerView"));
const Profile = lazy(() => import("./views/app/Profile"));
const AdminPanel = lazy(() => import("./views/app/AdminPanel"));
const TagManager = lazy(() => import("./views/app/TagManager"));
import ProtectedRoute from "./components/ProtectedRoute";
import ServerConfig from "./components/ServerConfig";
import PwaUpdater from "./pwa/PwaUpdater";
import { isNative, getServerUrl, setupAppListeners, setupStatusBar, getFontSize, getBoldFont, requestNotificationPermission, createNotificationChannel, requestExactAlarmPermission } from "./capacitor/register";
import { requestBrowserPermission } from "./lib/browserNotifications";
import { registerPushNotifications } from "./capacitor/pushNotifications";
import { setupNotificationActions } from "./capacitor/notificationActions";
import { setNavigator } from "./lib/navigation";
import { useThemeStore } from "./store/themeStore";
import { useSyncStore } from "./sync/syncStore";
import { initClientBaseUrl } from "./api/client";
import { startEventAutoRefresh } from "./store/icsCalendarStore";
import "./i18n";

// Minimal fallback while a lazily-loaded route chunk is fetched. It keeps the
// layout stable instead of flashing a blank page on slow connections.
function RouteFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary dark:border-gray-700 dark:border-t-primary" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ready, setReady] = useState(false);
  const [needsConfig, setNeedsConfig] = useState(false);
  const [fontSize, setFontSize] = useState("normal");
  const [boldFont, setBoldFontState] = useState(false);

  useEffect(() => {
    async function init() {
      if (isNative()) {
        setupAppListeners();
        void setupNotificationActions();
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
        startEventAutoRefresh();
      } else {
        const granted = await requestBrowserPermission();
        if (!granted) {
          console.warn("[browser] notification permission denied");
        }
      }
      setReady(true);
    }
    init();
  }, [initialize]);

  // Expose the router's navigate to non-React code (notification taps).
  useEffect(() => {
    setNavigator((path) => navigate(path));
    return () => setNavigator(null);
  }, [navigate]);

  const theme = useThemeStore((s) => s.theme);

  // Start the offline sync engine once a session exists, stop it on logout.
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      void useSyncStore.getState().start(user.id);
    } else if (!isAuthenticated) {
      useSyncStore.getState().stop();
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    setupStatusBar(theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  // Keep <html lang> in sync with the active language (a11y + correct hyphenation).
  useEffect(() => {
    const updateLang = () => {
      document.documentElement.lang = i18n.language;
    };
    updateLang();
    i18n.on("languageChanged", updateLang);
    return () => {
      i18n.off("languageChanged", updateLang);
    };
  }, []);

  // Match the browser/Android chrome colour to the active theme.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#070D19" : "#FAFAFA");
  }, [theme]);

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
    <MotionConfig reducedMotion="user">
    <div className={sizeClass}>
      {/* Web-only: register the service worker so the app shell loads offline. */}
      {import.meta.env.PROD && !isNative() && <PwaUpdater />}
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
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
