import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { usePomodoroStore, type PomodoroSettings } from "../../store/pomodoroStore";
import AppLayout from "../../components/AppLayout";
import { TimerSkeleton } from "../../components/Skeletons";
import { Target, Coffee, Palmtree, Check, X } from "lucide-react";

const SIZE = 240;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PHASE_LABELS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  FOCUS: { icon: <Target className="h-5 w-5" />, label: "Focus", color: "#14B8A6" },
  SHORT_BREAK: { icon: <Coffee className="h-5 w-5" />, label: "Short Break", color: "#F59E0B" },
  LONG_BREAK: { icon: <Palmtree className="h-5 w-5" />, label: "Long Break", color: "#3B82F6" },
};
const PHASE_OPTIONS: { value: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK"; label: string }[] = [
  { value: "FOCUS", label: "Focus" },
  { value: "SHORT_BREAK", label: "Short Break" },
  { value: "LONG_BREAK", label: "Long Break" },
];

export default function TimerView() {
  const { t } = useTranslation();
  const {
    session, remainingSeconds, isLoading, stats,
    fetchCurrent, start, pause, resume, complete, cancel, tick,
    fetchSettings, updateSettings, fetchStats,
  } = usePomodoroStore();

  const [showSettings, setShowSettings] = useState(false);
  const [customType, setCustomType] = useState<"FOCUS" | "SHORT_BREAK" | "LONG_BREAK" | null>(null);
  const prevCompletedRef = useRef(false);

  useEffect(() => {
    fetchCurrent();
    fetchSettings();
    fetchStats();
  }, [fetchCurrent, fetchSettings, fetchStats]);

  useEffect(() => {
    if (session?.state !== "RUNNING") return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.state, session?.id, tick]);

  useEffect(() => {
    if (session?.state === "COMPLETED" && !prevCompletedRef.current) {
      if ("Notification" in window && Notification.permission === "granted") {
        const phase = PHASE_LABELS[session.type] ?? PHASE_LABELS.FOCUS;
        new Notification(
          t("pomodoro.notificationTitle", { phase: phase.label }),
          { body: t("pomodoro.notificationBody", { duration: formatTime(session.duration * 60) }) }
        );
      }
    }
    prevCompletedRef.current = session?.state === "COMPLETED";
  }, [session?.state, session?.type, session?.duration, t]);

  const phase = session ? PHASE_LABELS[session.type] ?? PHASE_LABELS.FOCUS : PHASE_LABELS.FOCUS;
  const display = formatTime(remainingSeconds);
  const totalSeconds = session ? session.duration * 60 : 1500;
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const isWarning = remainingSeconds > 0 && remainingSeconds < 60;
  const isCompleted = session?.state === "COMPLETED";

  const handleStart = async () => {
    await start(customType ?? stats?.nextPhase ?? undefined);
    setCustomType(null);
  };

  const completedCount = stats?.focusCompleted ?? 0;
  const settings = usePomodoroStore.getState().settings;
  const cycleCount = settings.cycles;
  const filledDots = completedCount === 0
    ? 0
    : completedCount % cycleCount === 0
      ? cycleCount
      : completedCount % cycleCount;
  const chosenType = customType ?? stats?.nextPhase ?? "FOCUS";
  const readyLabel = PHASE_LABELS[chosenType] ?? PHASE_LABELS.FOCUS;

  if (isLoading) {
    return (
      <AppLayout title={t("menu.timer")}>
        <TimerSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t("bottomNav.timer")}>
      <div className="flex min-h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">{phase.icon}</span>
          <span className="font-outfit text-lg font-semibold text-gray-700 dark:text-gray-300" style={{ color: session ? phase.color : undefined }}>
            {phase.label}
          </span>
          <button onClick={() => setShowSettings(!showSettings)}
            className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title={t("pomodoro.settings")}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"
          >
            <SettingsForm
              settings={settings}
              onSave={async (s) => { await updateSettings(s); setShowSettings(false); }}
              onClose={() => setShowSettings(false)}
              t={t}
            />
          </motion.div>
        )}

        <div className="relative mx-auto mb-8 flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke="var(--color-progress-bg, #E5E7EB)" strokeWidth={STROKE} />
            <motion.circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke={isWarning ? "#EF4444" : phase.color} strokeWidth={STROKE}
              strokeLinecap="round" strokeDasharray={CIRCUMFERENCE}
              initial={false} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5, ease: "easeInOut" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-urbanist text-5xl font-bold tracking-tight tabular-nums ${
              isWarning ? "text-red-500" : "text-gray-900 dark:text-white"
            }`}>
              {display}
            </span>
            <span className="mt-1 font-urbanist text-xs text-gray-400 dark:text-gray-500">
              {session?.state === "RUNNING" ? t("pomodoro.running") : session?.state === "PAUSED" ? t("pomodoro.paused") : ""}
            </span>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-center gap-1.5">
          {Array.from({ length: cycleCount }, (_, i) => (
            i < filledDots ? (
              <span key={i} className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            ) : (
              <span key={i} className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300 dark:border-gray-600" />
            )
          ))}
          <span className="ml-2 font-urbanist text-xs text-gray-400 dark:text-gray-500">
            {completedCount > 0 ? t("pomodoro.completedToday", { count: completedCount }) : ""}
          </span>
        </div>

        {(!session || isCompleted) && (
          <div className="mb-6">
            <div className="flex gap-2">
              {PHASE_OPTIONS.map((opt) => {
                const selected = (customType ?? stats?.nextPhase ?? "FOCUS") === opt.value;
                const c = PHASE_LABELS[opt.value].color;
                return (
                  <button key={opt.value}
                    onClick={() => setCustomType(opt.value)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      selected ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                    style={selected ? { backgroundColor: c } : undefined}>
                    {PHASE_LABELS[opt.value].icon} {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-3">
          {!session && (
            <motion.button onClick={handleStart}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-urbanist text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
              {readyLabel.icon} {t("pomodoro.start")}
            </motion.button>
          )}

          {session && session.state === "RUNNING" && (
            <div className="flex w-full gap-3">
              <motion.button onClick={pause}
                whileTap={{ scale: 0.95 }}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-3 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                {t("pomodoro.pause")}
              </motion.button>
              <motion.button onClick={complete}
                whileTap={{ scale: 0.95 }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-50 px-4 py-3 font-urbanist text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50">
                  <Check className="h-4 w-4" /> {t("pomodoro.complete")}
              </motion.button>
              <motion.button onClick={cancel}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl px-3 py-3 font-urbanist text-sm font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800 dark:hover:text-red-400">
                  <X className="h-4 w-4" />
              </motion.button>
            </div>
          )}

          {session?.state === "PAUSED" && (
            <div className="flex w-full gap-3">
              <motion.button onClick={resume}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex-1 rounded-xl bg-primary px-4 py-3 font-urbanist text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
                {t("pomodoro.resume")}
              </motion.button>
              <motion.button onClick={complete}
                whileTap={{ scale: 0.95 }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-50 px-4 py-3 font-urbanist text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50">
                  <Check className="h-4 w-4" /> {t("pomodoro.complete")}
              </motion.button>
              <motion.button onClick={cancel}
                whileTap={{ scale: 0.95 }}
                className="rounded-xl px-3 py-3 font-urbanist text-sm font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800 dark:hover:text-red-400">
                  <X className="h-4 w-4" />
              </motion.button>
            </div>
          )}

          {isCompleted && (
            <motion.button onClick={handleStart}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-6 py-3 font-urbanist text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
              {readyLabel.icon} {t("pomodoro.start")} {readyLabel.label}
            </motion.button>
          )}
        </div>
      </div>
      </div>
    </AppLayout>
  );
}

function SettingsForm({ settings, onSave, onClose, t }: {
  settings: PomodoroSettings;
  onSave: (s: Partial<PomodoroSettings>) => Promise<void>;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [work, setWork] = useState(settings.work);
  const [shortBreak, setShortBreak] = useState(settings.shortBreak);
  const [longBreak, setLongBreak] = useState(settings.longBreak);
  const [cycles, setCycles] = useState(settings.cycles);

  return (
    <div className="space-y-3">
      <SliderField label={t("pomodoro.work")} value={work} min={1} max={120} step={1} suffix="min" onChange={setWork} />
      <SliderField label={t("pomodoro.shortBreak")} value={shortBreak} min={1} max={30} step={1} suffix="min" onChange={setShortBreak} />
      <SliderField label={t("pomodoro.longBreak")} value={longBreak} min={1} max={60} step={1} suffix="min" onChange={setLongBreak} />
      <SliderField label={t("pomodoro.cycles")} value={cycles} min={1} max={10} step={1} suffix="" onChange={setCycles} />
      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 rounded-lg bg-gray-200 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          {t("pomodoro.cancelSettings")}
        </button>
        <button onClick={() => onSave({ work, shortBreak, longBreak, cycles })}
          className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark">
          {t("pomodoro.save")}
        </button>
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, step, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="font-urbanist text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
        <span className="font-urbanist text-xs font-semibold text-gray-800 dark:text-gray-200">
          {value}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary dark:bg-gray-700" />
    </div>
  );
}
