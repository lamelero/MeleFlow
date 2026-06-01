import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import AuthLayout from "./AuthLayout";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";
import { translateAuthError } from "../../lib/translate-error";

export default function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setConfirmError(null);

    if (password !== confirmPassword) {
      setConfirmError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setSubmitting(true);
    try {
      await register(email, username, password);
      navigate("/app");
    } catch {
      // error is set in store
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = confirmError || (error ? translateAuthError(error, t) : null);

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <h2 className="font-outfit text-xl font-semibold text-gray-900 dark:text-white">
          {t("auth.createAccount")}
        </h2>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
      <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">
        {t("auth.startManaging")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {displayError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 font-urbanist text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {displayError}
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
            htmlFor="username"
            className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("auth.username")}
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearError();
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder={t("auth.usernamePlaceholder")}
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder={t("auth.passwordMinPlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("auth.confirmPassword")}
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmError(null);
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder={t("auth.confirmPasswordPlaceholder")}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </form>

      <p className="mt-6 text-center font-urbanist text-sm text-gray-500 dark:text-gray-400">
        {t("auth.hasAccount")}{" "}
        <Link
          to="/login"
          className="font-medium text-primary hover:underline"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthLayout>
  );
}
