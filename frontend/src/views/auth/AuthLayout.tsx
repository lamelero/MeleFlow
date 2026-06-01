import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const gridBg = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" patternUnits="userSpaceOnUse" width="60" height="60"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(20,184,166,0.03)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>',
)}"`;

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
    >
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl dark:opacity-20" style={{ backgroundColor: "#14B8A6" }} />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl dark:opacity-10" style={{ backgroundColor: "#6C5CE7" }} />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 rounded-full opacity-15 blur-3xl dark:opacity-10" style={{ backgroundColor: "#FF6B6B" }} />

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 dark:opacity-50"
        style={{ backgroundImage: gridBg }}
      />

      {/* Decorative illustration */}
      <div className="pointer-events-none absolute bottom-8 left-8 hidden opacity-20 lg:block dark:opacity-10">
        <svg width="280" height="280" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="40" width="80" height="80" rx="12" stroke="#14B8A6" strokeWidth="2" fill="none" />
          <rect x="130" y="30" width="90" height="90" rx="16" stroke="#6C5CE7" strokeWidth="2" fill="none" />
          <rect x="60" y="140" width="160" height="60" rx="10" stroke="#14B8A6" strokeWidth="2" fill="none" />
          <circle cx="180" cy="200" r="30" stroke="#FF6B6B" strokeWidth="2" fill="none" />
          <circle cx="50" cy="230" r="15" stroke="#FFD93D" strokeWidth="2" fill="none" />
          <path d="M40 80 L70 80" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
          <path d="M130 70 L160 70" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" />
          <path d="M70 170 L140 170" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", damping: 15 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(20,184,166,0.1)" }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="8" width="20" height="16" rx="3" stroke="#14B8A6" strokeWidth="2" />
              <path d="M8 8V6a2 2 0 012-2h8a2 2 0 012 2v2" stroke="#14B8A6" strokeWidth="2" />
              <path d="M10 14l3 3 5-5" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
          <motion.h1
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="font-outfit text-3xl font-bold tracking-tight dark:text-white"
            style={{ color: "#1a1a2e" }}
          >
            {t("auth.taskflow")}
          </motion.h1>
          <motion.p
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-1 font-urbanist text-sm dark:text-gray-400"
            style={{ color: "#6B7280" }}
          >
            {t("auth.taskflowTagline")}
          </motion.p>
        </div>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="rounded-2xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:border-gray-800 dark:bg-gray-900/80 dark:ring-white/5"
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
