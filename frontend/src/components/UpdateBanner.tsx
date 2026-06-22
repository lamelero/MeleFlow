import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { skipVersion } from "../lib/updateChecker";
import { isNative } from "../capacitor/register";

interface UpdateBannerProps {
  version: string;
  url: string;
  downloadUrl: string;
  onDismiss: () => void;
}

export default function UpdateBanner({ version, url, downloadUrl, onDismiss }: UpdateBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  function handleDownload() {
    if (isNative() && downloadUrl) {
      window.location.href = downloadUrl;
    } else {
      window.open(url, "_blank");
    }
  }

  function handleSkip() {
    skipVersion(version);
    setVisible(false);
    onDismiss();
  }

  function handleDismiss() {
    setVisible(false);
    onDismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/20">
            <span className="shrink-0 text-lg">🚀</span>
            <p className="flex-1 font-urbanist text-sm font-medium text-amber-800 dark:text-amber-300">
              {t("update.available", { version }) || `MeleFlow v${version} available`}
            </p>
            <button
              onClick={handleDownload}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-amber-700"
            >
              {t("update.download") || "Download"}
            </button>
            <button
              onClick={handleSkip}
              className="shrink-0 rounded-lg px-2 py-1.5 font-urbanist text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
            >
              {t("update.skip") || "Skip"}
            </button>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1 text-amber-400 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
              title={t("common.close") || "Close"}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
