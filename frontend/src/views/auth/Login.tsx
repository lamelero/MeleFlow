import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import AuthLayout from "./AuthLayout";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import ThemeToggle from "../../components/ThemeToggle";
import { translateAuthError } from "../../lib/translate-error";
import { isNative, getServerUrl, setServerUrl, getServers, addServer, removeServer, setActiveServer, updateServer } from "../../capacitor/register";
import type { ServerEntry } from "../../capacitor/register";
import { reRegisterPushToken, registerPushNotifications } from "../../capacitor/pushNotifications";
import { initClientBaseUrl } from "../../api/client";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverUrl, setServerUrlState] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerLabel, setNewServerLabel] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editServerLabel, setEditServerLabel] = useState("");
  const [editServerUrl, setEditServerUrl] = useState("");

  useEffect(() => {
    if (isNative()) {
      getServers().then((list) => {
        setServers(list);
        const active = list.find((s) => s.url === serverUrl) || list[0];
        if (active) {
          setServerUrlState(active.url);
          setServerUrlInput(active.url);
        }
      });
    }
    fetch("/api/settings/registration-status")
      .then((r) => r.json())
      .then((data) => setRegistrationAllowed(data.allowRegistration))
      .catch(() => {});
  }, []);

  function formatServerUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname + (u.port ? ":" + u.port : "");
    } catch {
      return url;
    }
  }

  async function handleSelectServer(server: ServerEntry) {
    await setActiveServer(server.id);
    setServerUrlState(server.url);
    setServerUrlInput(server.url);
    setEditingUrl(false);
    await initClientBaseUrl();
    await reRegisterPushToken();
  }

  async function handleSaveServerUrl() {
    const trimmed = serverUrlInput.trim().replace(/\/+$/, "");
    if (!trimmed) return;
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `http://${finalUrl}`;
    }
    try {
      new URL(finalUrl);
    } catch {
      return;
    }
    if (editingServerId) {
      await updateServer(editingServerId, { url: finalUrl, label: editServerLabel });
      setEditingServerId(null);
    } else {
      await setServerUrl(finalUrl);
    }
    const list = await getServers();
    setServers(list);
    setServerUrlState(finalUrl);
    setEditingUrl(false);
    await initClientBaseUrl();
    await reRegisterPushToken();
  }

  async function handleAddServer() {
    const trimmed = newServerUrl.trim().replace(/\/+$/, "");
    if (!trimmed || !newServerLabel.trim()) return;
    let finalUrl = trimmed;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `http://${finalUrl}`;
    }
    try {
      new URL(finalUrl);
    } catch {
      return;
    }
    await addServer(newServerLabel.trim(), finalUrl);
    setNewServerLabel("");
    setNewServerUrl("");
    setShowAddServer(false);
    const list = await getServers();
    setServers(list);
    const active = list[list.length - 1];
    setServerUrlState(active.url);
    setServerUrlInput(active.url);
    await initClientBaseUrl();
    await reRegisterPushToken();
  }

  async function handleRemoveServer(id: string) {
    await removeServer(id);
    const list = await getServers();
    setServers(list);
    if (list.length > 0) {
      setServerUrlState(list[0].url);
      setServerUrlInput(list[0].url);
      await initClientBaseUrl();
    } else {
      setServerUrlState("");
      setServerUrlInput("");
    }
  }

  function handleEditServer(server: ServerEntry) {
    setEditingServerId(server.id);
    setEditServerLabel(server.label);
    setEditServerUrl(server.url);
    setEditingUrl(true);
  }

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
        if (isNative()) await registerPushNotifications();
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

      {isNative() && servers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {servers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectServer(s)}
              onContextMenu={(e) => { e.preventDefault(); handleEditServer(s); }}
              className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                s.url === serverUrl
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600"
              }`}
            >
              {s.url === serverUrl && (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              <span className="truncate max-w-24">{s.label}</span>
              <span className="truncate max-w-20 opacity-60">{formatServerUrl(s.url)}</span>
              <span
                onClick={(e) => { e.stopPropagation(); handleEditServer(s); }}
                className="ml-0.5 hidden rounded p-0.5 text-gray-400 hover:text-gray-600 group-hover:inline-flex dark:hover:text-gray-300"
                title={t("common.edit") || "Edit"}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M11.5 1.5l3 3L7 12H4v-3z" />
                </svg>
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); handleRemoveServer(s.id); }}
                className="ml-0.5 hidden rounded p-0.5 text-gray-400 hover:text-red-500 group-hover:inline-flex"
                title={t("common.delete") || "Delete"}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="13" y2="13" />
                  <line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAddServer(true)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500 dark:border-gray-600 dark:text-gray-500 dark:hover:border-gray-500"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            {t("auth.addServer") || "Add server"}
          </button>
        </div>
      )}

      {isNative() && showAddServer && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
          <div className="mb-2">
            <input
              type="text"
              value={newServerLabel}
              onChange={(e) => setNewServerLabel(e.target.value)}
              placeholder={t("auth.serverLabel") || "Label (e.g. Oficina, Casa)"}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
          </div>
          <div className="mb-2">
            <input
              type="text"
              value={newServerUrl}
              onChange={(e) => setNewServerUrl(e.target.value)}
              placeholder="192.168.100.10:33800"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddServer}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600"
            >
              {t("common.add") || "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddServer(false); setNewServerLabel(""); setNewServerUrl(""); }}
              className="flex-1 rounded-lg bg-gray-200 px-3 py-1.5 font-urbanist text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {t("common.cancel") || "Cancel"}
            </button>
          </div>
        </div>
      )}

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
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-10 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder={t("auth.passwordPlaceholder")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20 dark:border-gray-600"
          />
          <span className="font-urbanist text-sm text-gray-600 dark:text-gray-400">{t("auth.rememberMe")}</span>
        </label>

        {isNative() && editingUrl && (
          <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="mb-2">
              <input
                type="text"
                value={editServerLabel}
                onChange={(e) => setEditServerLabel(e.target.value)}
                placeholder={t("auth.serverLabel") || "Label"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <input
              type="text"
              value={serverUrlInput}
              onChange={(e) => setServerUrlInput(e.target.value)}
              placeholder="192.168.100.210:3001"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-urbanist text-xs outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="rounded-lg bg-primary px-3 py-1.5 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600"
              >
                {t("common.save") || "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setEditingUrl(false); setEditingServerId(null); }}
                className="rounded-lg px-3 py-1.5 font-urbanist text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t("common.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-outfit font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      {registrationAllowed && (
        <p className="mt-6 text-center font-urbanist text-sm text-gray-500 dark:text-gray-400">
          {t("auth.noAccount")}{" "}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            {t("auth.signUp")}
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
