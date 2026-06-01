import { useState, type FormEvent, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import AuthLayout from "./AuthLayout";
import LanguageSwitcher from "../../components/LanguageSwitcher";

export default function TwoFactorVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { verify2FA, error, clearError } = useAuthStore();

  const twoFactorToken = (location.state as { twoFactorToken?: string })?.twoFactorToken;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!twoFactorToken) {
      navigate("/login", { replace: true });
    }
  }, [twoFactorToken, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

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
      await verify2FA(twoFactorToken, fullCode);
      navigate("/app");
    } catch {
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <h2 className="font-outfit text-xl font-semibold text-gray-900">
          Two-Factor Authentication
        </h2>
        <LanguageSwitcher />
      </div>
      <p className="mt-1 font-urbanist text-sm text-gray-500">
        Enter the 6-digit code from your authenticator app or a recovery code.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600">
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
              className="h-14 w-12 rounded-xl border border-gray-200 text-center font-outfit text-xl font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting || code.join("").length !== 6}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full text-center font-urbanist text-sm text-gray-500 hover:text-gray-700"
        >
          Back to login
        </button>
      </form>
    </AuthLayout>
  );
}
