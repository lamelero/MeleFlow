import { useState, type FormEvent, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import AuthLayout from "./AuthLayout";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";
import { registerPushNotifications } from "../../capacitor/pushNotifications";
import { isNative } from "../../capacitor/register";

const RESEND_COOLDOWN = 60;

export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { verify2FA, sendOTP, error, clearError } = useAuthStore();

  const state = location.state as {
    twoFactorToken?: string;
    method?: "totp" | "email";
    email?: string;
  } | null;
  const twoFactorToken = state?.twoFactorToken;
  const method = state?.method || "totp";
  const email = state?.email || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(method === "email");
  const [resendCooldown, setResendCooldown] = useState(method === "email" ? RESEND_COOLDOWN : 0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!twoFactorToken) {
      navigate("/login", { replace: true });
    }
  }, [twoFactorToken, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  function handleChange(index: number, value: string) {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    clearError();

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length === 6) {
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!twoFactorToken) return;

    const fullCode = code.join("");
    if (fullCode.length !== 6) return;

    setSubmitting(true);
    try {
      await verify2FA(twoFactorToken, fullCode, trustDevice);
      if (isNative()) await registerPushNotifications();
      navigate("/app");
    } catch {
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!twoFactorToken || resendCooldown > 0) return;
    setSendingOtp(true);
    try {
      await sendOTP(twoFactorToken);
      setOtpSent(true);
      setResendCooldown(RESEND_COOLDOWN);
    } catch {
      // error set in store
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <h2 className="font-outfit text-xl font-semibold text-gray-900 dark:text-white">
          {t("auth.verifyCode") || "Verify Code"}
        </h2>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
      <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">
        {method === "email"
          ? `${t("auth.emailCodeSent") || "Enter the code sent to"} ${email}`
          : t("auth.twoFactorCode")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              autoComplete="one-time-code"
              className="h-14 w-12 rounded-xl border border-gray-200 bg-white text-center font-outfit text-xl font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
          />
          <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">
            {t("auth.trustDevice")}
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting || code.join("").length !== 6}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("auth.verifying") || "Verifying..." : t("auth.verify")}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={sendingOtp || resendCooldown > 0}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {sendingOtp
            ? t("auth.sending") || "Sending..."
            : resendCooldown > 0
              ? `${t("auth.resendCode")} (${resendCooldown}s)`
              : t("auth.resendCode")}
        </button>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full text-center font-urbanist text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {t("auth.backToLogin")}
        </button>
      </form>
    </AuthLayout>
  );
}
