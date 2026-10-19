import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Registers the MeleFlow service worker (web builds only) and surfaces the
 * "ready offline" and "update available" notifications. Native (Capacitor)
 * builds skip rendering this component entirely — see App.tsx.
 */
export default function PwaUpdater() {
  const { t } = useTranslation();

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("[pwa] service worker registration failed:", error);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    toast.success(t("pwa.offlineReady", "La aplicación ya funciona sin conexión"));
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, t]);

  useEffect(() => {
    if (!needRefresh) return;

    const id = toast.custom(
      (instance) => (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
          <span className="text-sm text-gray-800 dark:text-gray-100">
            {t("pwa.updateAvailable", "Hay una nueva versión disponible")}
          </span>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            onClick={() => {
              toast.dismiss(instance.id);
              void updateServiceWorker(true);
            }}
          >
            {t("pwa.reload", "Recargar")}
          </button>
          <button
            type="button"
            className="text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => {
              toast.dismiss(instance.id);
              setNeedRefresh(false);
            }}
          >
            {t("pwa.later", "Más tarde")}
          </button>
        </div>
      ),
      { duration: Infinity, id: "pwa-update" }
    );

    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker, t]);

  return null;
}
