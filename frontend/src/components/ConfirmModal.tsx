import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  /** If true, shows a textarea for additional input (replaces prompt()) */
  input?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean | string) => void;
}

let confirmState: ConfirmState | null = null;
let setGlobalState: ((s: ConfirmState | null) => void) | null = null;

export function showConfirm(opts: ConfirmOptions): Promise<boolean | string> {
  return new Promise((resolve) => {
    if (setGlobalState) {
      setGlobalState({ ...opts, resolve });
    }
  });
}

export default function ConfirmModal() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setGlobalState = (s) => {
      setState(s);
      if (s?.input) setInputVal(s.inputValue || "");
    };
    return () => { setGlobalState = null; };
  }, []);

  useEffect(() => {
    if (state?.input && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state?.input]);

  if (!state) return null;

  const handleClose = (result: boolean | string) => {
    setState(null);
    state.resolve(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => handleClose(false)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`mb-2 font-outfit text-lg font-semibold ${state.variant === "danger" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
          {state.title}
        </h2>
        <p className="mb-4 font-urbanist text-sm text-gray-600 dark:text-gray-400">{state.message}</p>

        {state.input && (
          <textarea
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={state.inputPlaceholder || ""}
            rows={3}
            className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        )}

        <div className="flex justify-end gap-3">
          <button onClick={() => handleClose(false)}
            className="rounded-xl bg-gray-100 px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            {state.cancelText || "Cancelar"}
          </button>
          <button onClick={() => handleClose(state.input ? inputVal : true)}
            className={`rounded-xl px-4 py-2.5 font-urbanist text-sm font-medium text-white transition-colors ${
              state.variant === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary-hover"
            }`}>
            {state.confirmText || "Aceptar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
