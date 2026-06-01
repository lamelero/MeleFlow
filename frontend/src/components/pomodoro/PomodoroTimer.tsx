import { useEffect } from "react";
import { motion } from "framer-motion";
import { usePomodoroStore } from "../../store/pomodoroStore";

const SIZE = 36;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function PomodoroTimer() {
  const { session, remainingSeconds, isLoading, start, pause, resume, complete, tick, fetchCurrent } =
    usePomodoroStore();

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  useEffect(() => {
    if (session?.state !== "RUNNING") return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.state, session?.id, tick]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const duration = session?.duration ? session.duration * 60 : 1500;
  const progress = 1 - remainingSeconds / duration;
  const offset = CIRCUMFERENCE * (1 - progress);
  const isWarning = remainingSeconds < 60;
  const strokeColor = isWarning ? "#EF4444" : "#14B8A6";

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session || session.state === "COMPLETED") {
    return (
      <motion.button
        onClick={() => start()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 font-urbanist text-xs font-medium text-primary transition-colors hover:bg-primary/20 dark:bg-primary/20"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Focus
      </motion.button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
      <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-progress-bg, #E5E7EB)"
            strokeWidth={STROKE}
            className="transition-colors"
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="transition-colors"
            style={{ transition: "stroke 0.3s ease" }}
          />
        </svg>
        {isWarning && (
          <motion.span
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
          />
        )}
      </div>

      <span className={`font-urbanist text-xs font-mono tabular-nums ${isWarning ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
        {display}
      </span>

      <div className="flex gap-0.5">
        {session.state === "RUNNING" ? (
          <motion.button
            onClick={pause}
            whileTap={{ scale: 0.85 }}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Pause"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
            </svg>
          </motion.button>
        ) : (
          <motion.button
            onClick={resume}
            whileTap={{ scale: 0.85 }}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Resume"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          </motion.button>
        )}
        <motion.button
          onClick={complete}
          whileTap={{ scale: 0.85 }}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 hover:text-green-600 dark:hover:bg-gray-700 dark:hover:text-green-400"
          title="Complete"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
