import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import AuthLayout from "./AuthLayout";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";
import { translateAuthError } from "../../lib/translate-error";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(email, password, rememberMe);
      if (result.requiresTwoFactor && result.twoFactorToken) {
        navigate("/login/2fa", {
          state: {
            twoFactorToken: result.twoFactorToken,
            method: result.twoFactorMethod || "totp",
            email: result.user?.email || email,
          },
        });
      } else {
        navigate("/app");
      }
    } catch {
      // error is set in store
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <h2 className="font-outfit text-xl font-semibold text-gray-900 dark:text-white">
          {t("auth.welcomeBack")}
        </h2>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
      <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">
        {t("auth.signInToAccount")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {translateAuthError(error, t)}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder={t("auth.passwordPlaceholder")}
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20 dark:border-gray-600"
          />
          <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">Remember me</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <p className="mt-6 text-center font-urbanist text-sm text-gray-500 dark:text-gray-400">
        {t("auth.noAccount")}{" "}
        <Link
          to="/register"
          className="font-medium text-primary hover:underline"
        >
          {t("auth.signUp")}
        </Link>
      </p>
    </AuthLayout>
  );
}
