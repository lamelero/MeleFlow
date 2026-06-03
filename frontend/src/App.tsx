import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import i18n from "./i18n";
import Login from "./views/auth/Login";
import Register from "./views/auth/Register";
import TwoFactorVerify from "./views/auth/TwoFactorVerify";
import Dashboard from "./views/app/Dashboard";
import CalendarView from "./views/app/CalendarView";
import Profile from "./views/app/Profile";
import AdminPanel from "./views/app/AdminPanel";
import TagManager from "./views/app/TagManager";
import ProtectedRoute from "./components/ProtectedRoute";
import "./i18n";

export default function App() {
  const location = useLocation();
  const initialize = useAuthStore((s) => s.initialize);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  return (
    <>
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
            element={
              <ProtectedRoute>
                <CalendarView />
              </ProtectedRoute>
            }
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
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
