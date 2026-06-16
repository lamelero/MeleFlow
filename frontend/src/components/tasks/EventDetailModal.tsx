import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ExternalCalendarEvent } from "../../store/icsCalendarStore";

interface EventDetailModalProps {
  event: ExternalCalendarEvent | null;
  onClose: () => void;
}

export default function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { t } = useTranslation();

  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full rounded-t-2xl bg-white p-6 shadow-xl dark:bg-gray-900 md:max-w-sm md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
              <h3 className="break-words font-outfit text-lg font-semibold text-gray-900 dark:text-gray-100">
                {event.title}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">
                  {startDate.toLocaleDateString(undefined, dateOptions)}
                </span>
              </div>

              {!event.isAllDay && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">
                    {startDate.toLocaleTimeString(undefined, timeOptions)} — {endDate.toLocaleTimeString(undefined, timeOptions)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {event.sourceName}
                </span>
              </div>

              {event.description && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="break-words font-urbanist text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>
              )}

              {event.location && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="break-words font-urbanist text-sm text-gray-600 dark:text-gray-400">
                    {event.location}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("common.close") || "Close"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
