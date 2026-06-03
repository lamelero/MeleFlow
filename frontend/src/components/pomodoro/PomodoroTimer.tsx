import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePomodoroStore, type PomodoroSettings } from "../../store/pomodoroStore";

const SIZE = 36;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // audio not available
  }
}

const PHASE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  FOCUS: { icon: "🎯", label: "Focus", color: "#14B8A6" },
  SHORT_BREAK: { icon: "☕", label: "Break", color: "#F59E0B" },
  LONG_BREAK: { icon: "🌴", label: "Long Break", color: "#3B82F6" },
};

const PHASE_OPTIONS: { value: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK"; label: string }[] = [
  { value: "FOCUS", label: "Focus" },
  { value: "SHORT_BREAK", label: "Short Break" },
  { value: "LONG_BREAK", label: "Long Break" },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PomodoroTimer() {
  const {
    session, remainingSeconds, isLoading, settings, stats,
    fetchCurrent, start, pause, resume, complete, tick,
    fetchSettings, updateSettings, fetchStats,
  } = usePomodoroStore();

  const [open, setOpen] = useState(false);
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

  // Play beep when session completes
  useEffect(() => {
    if (session?.state === "COMPLETED" && !prevCompletedRef.current) {
      playBeep();
      if ("Notification" in window && Notification.permission === "granted") {
        const phase = PHASE_LABELS[session.type] ?? PHASE_LABELS.FOCUS;
        new Notification(`${phase.label} Complete!`, {
          body: `${formatTime(session.duration * 60)} session finished.`,
        });
      }
    }
    prevCompletedRef.current = session?.state === "COMPLETED";
  }, [session?.state, session?.type, session?.duration]);

  const phase = session ? PHASE_LABELS[session.type] ?? PHASE_LABELS.FOCUS : PHASE_LABELS.FOCUS;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const display = formatTime(remainingSeconds);
  const totalSeconds = session ? session.duration * 60 : 1500;
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  const isWarning = remainingSeconds > 0 && remainingSeconds < 60;
  const isCompleted = session?.state === "COMPLETED";

  const handleStart = async () => {
    await start(customType ?? undefined);
    setCustomType(null);
  };

  const handleSettingsSave = async (s: Partial<PomodoroSettings>) => {
    await updateSettings(s);
    setShowSettings(false);
  };

  // Navbar pill
  const pill = () => {
    if (isLoading) {
      return (
        <div className="flex cursor-pointer items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 dark:bg-gray-800"
          onClick={() => setOpen(true)}>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    if (!session || isCompleted) {
      const chkStats = stats ?? { nextPhase: "FOCUS" as const, focusCompleted: 0, cycles: 4, completedToday: 0 };
      const nextLabel = PHASE_LABELS[chkStats.nextPhase] ?? PHASE_LABELS.FOCUS;
      return (
        <motion.button
          onClick={() => setOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 font-urbanist text-xs font-medium text-primary transition-colors hover:bg-primary/20 dark:bg-primary/20"
        >
          <span>{nextLabel.icon}</span>
          <span>{nextLabel.label}</span>
        </motion.button>
      );
    }

    return (
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 dark:bg-gray-800"
      >
        <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke="var(--color-progress-bg, #E5E7EB)" strokeWidth={STROKE} />
            <motion.circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke={isWarning ? "#EF4444" : phase.color} strokeWidth={STROKE}
              strokeLinecap="round" strokeDasharray={CIRCUMFERENCE}
              initial={false} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5, ease: "easeInOut" }} />
          </svg>
          {isWarning && (
            <motion.span className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              style={{ backgroundColor: "rgba(239,68,68,0.08)" }} />
          )}
        </div>
        <span className={`font-urbanist font-mono text-xs tabular-nums ${isWarning ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
          {display}
        </span>
      </motion.button>
    );
  };

  const completedCount = stats?.focusCompleted ?? 0;
  const cycleCount = settings.cycles;
  const filledDots = completedCount === 0
    ? 0
    : completedCount % cycleCount === 0
      ? cycleCount
      : completedCount % cycleCount;

  return (
    <>
      {pill()}
      {createPortal(
        <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-gray-200/50 bg-white p-6 shadow-2xl dark:border-gray-700/50 dark:bg-gray-900"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Phase label */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{phase.icon}</span>
                  <span className="font-urbanist text-sm font-semibold text-gray-700 dark:text-gray-300"
                    style={{ color: session ? phase.color : undefined }}>
                    {phase.label}
                  </span>
                </div>
                <button onClick={() => { setShowSettings(!showSettings); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  title="Settings">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* Settings panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-4 space-y-3 overflow-hidden rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"
                  >
                    <SettingsForm settings={settings} onSave={handleSettingsSave} onClose={() => setShowSettings(false)} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timer display */}
              <div className="my-6 text-center">
                <div className="font-urbanist text-6xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
                  {display}
                </div>
              </div>

              {/* Progress dots */}
              <div className="mb-5 flex items-center justify-center gap-1.5">
                {Array.from({ length: cycleCount }, (_, i) => (
                  <span key={i} className="text-sm">
                    {i < filledDots ? "🍅" : "◻️"}
                  </span>
                ))}
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                  {completedCount > 0 ? `${completedCount} today` : ""}
                </span>
              </div>

              {/* Phase selector (when no session) */}
              {(!session || isCompleted) && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    {PHASE_OPTIONS.map((opt) => {
                      const selected = (customType ?? stats?.nextPhase ?? "FOCUS") === opt.value;
                      const c = PHASE_LABELS[opt.value].color;
                      return (
                        <button key={opt.value}
                          onClick={() => setCustomType(opt.value)}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${selected ? "text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}
                          style={selected ? { backgroundColor: c } : undefined}>
                          {PHASE_LABELS[opt.value].icon} {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-center gap-3">
                {!session && (
                  <motion.button onClick={handleStart}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
                    Start
                  </motion.button>
                )}

                {session && session.state === "RUNNING" && (
                  <>
                    <motion.button onClick={pause}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                      Pause
                    </motion.button>
                    <motion.button onClick={complete}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 rounded-xl bg-green-50 px-4 py-2.5 font-urbanist text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50">
                      Complete
                    </motion.button>
                  </>
                )}

                {session?.state === "PAUSED" && (
                  <>
                    <motion.button onClick={resume}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
                      Resume
                    </motion.button>
                    <motion.button onClick={complete}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 rounded-xl bg-green-50 px-4 py-2.5 font-urbanist text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50">
                      Complete
                    </motion.button>
                  </>
                )}

                {isCompleted && (
                  <motion.button onClick={handleStart}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-urbanist text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark">
                    {stats?.nextPhase === "LONG_BREAK" ? "🌴 Start Long Break" :
                     stats?.nextPhase === "SHORT_BREAK" ? "☕ Start Break" : "🎯 Start Focus"}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}
    </>
  );
}

function SettingsForm({ settings, onSave, onClose }: {
  settings: PomodoroSettings;
  onSave: (s: Partial<PomodoroSettings>) => Promise<void>;
  onClose: () => void;
}) {
  const [work, setWork] = useState(settings.work);
  const [shortBreak, setShortBreak] = useState(settings.shortBreak);
  const [longBreak, setLongBreak] = useState(settings.longBreak);
  const [cycles, setCycles] = useState(settings.cycles);

  return (
    <div className="space-y-3">
      <SliderField label="Work" value={work} min={1} max={120} step={1} suffix="min" onChange={setWork} />
      <SliderField label="Short Break" value={shortBreak} min={1} max={30} step={1} suffix="min" onChange={setShortBreak} />
      <SliderField label="Long Break" value={longBreak} min={1} max={60} step={1} suffix="min" onChange={setLongBreak} />
      <SliderField label="Cycles" value={cycles} min={1} max={10} step={1} suffix="" onChange={setCycles} />

      <div className="flex gap-2 pt-1">
        <button onClick={onClose}
          className="flex-1 rounded-lg bg-gray-200 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          Cancel
        </button>
        <button onClick={() => onSave({ work, shortBreak, longBreak, cycles })}
          className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark">
          Save
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
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
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
