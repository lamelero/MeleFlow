import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { client } from "../../api/client";
import { resolveImageUrl } from "../../lib/url";
import { useIcsCalendarStore } from "../../store/icsCalendarStore";
import AppLayout from "../../components/AppLayout";
import { isNative, getFontSize, setFontSize, getBoldFont, setBoldFont } from "../../capacitor/register";
import { LocalNotifications } from "@capacitor/local-notifications";
import { version as appVersion } from "../../../package.json";
import { scheduleTestNotification } from "../../lib/testNotification";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const ICS_COLORS = [
  "#6366f1", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateLanguage, updateProfile, uploadAvatar } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    calendars: icsCalendars,
    loading: icsLoading,
    syncing,
    fetchCalendars,
    addCalendar,
    removeCalendar,
    syncCalendar,
  } = useIcsCalendarStore();

  const [activeTab, setActiveTab] = useState<"general" | "security" | "calendars">("general");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("");

  // 2FA state
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [isTwoFactorConfigured, setIsTwoFactorConfigured] = useState(false);
  const [qrUri, setQrUri] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [setupCode, setSetupCode] = useState("");
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // ICS calendar form state
  const [icsName, setIcsName] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  const [icsColor, setIcsColor] = useState(ICS_COLORS[0]);
  const [addingIcs, setAddingIcs] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("normal");
  const [boldFont, setBoldFontState] = useState(false);

  useEffect(() => {
    if (isNative()) Promise.all([
      getFontSize().then(setCurrentFontSize),
      getBoldFont().then(setBoldFontState),
    ]);
  }, []);

  const FONT_SIZES = [
    { value: "small", label: t("profile.fontSizeSmall") },
    { value: "normal", label: t("profile.fontSizeNormal") },
    { value: "large", label: t("profile.fontSizeLarge") },
    { value: "xlarge", label: t("profile.fontSizeXlarge") },
  ];

  async function handleFontSizeChange(size: string) {
    setCurrentFontSize(size);
    await setFontSize(size);
    document.documentElement.style.fontSize =
      size === "small" ? "14px" :
      size === "large" ? "18px" :
      size === "xlarge" ? "20px" :
      "16px";
  }

  async function handleBoldToggle() {
    const next = !boldFont;
    setBoldFontState(next);
    await setBoldFont(next);
    document.documentElement.style.fontWeight = next ? "600" : "";
  }

  useEffect(() => {
    fetch2FAStatus();
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setNotificationEmail(user.notificationEmail || "");
      setBio(user.bio || "");
      setTimezone(user.timezone || "");
    }
  }, [user]);

  async function fetch2FAStatus() {
    try {
      const { data } = await client.get("/auth/2fa/status");
      setIsTwoFactorEnabled(data.isTwoFactorEnabled);
      setIsTwoFactorConfigured(data.isConfigured);
      if (data.uri) setQrUri(data.uri);
    } catch {
      // ignore
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName || undefined,
        notificationEmail: notificationEmail || undefined,
        bio: bio || undefined,
        timezone: timezone || undefined,
      });
      toast.success(t("profile.toasts.profileUpdated"));
    } catch {
      toast.error(t("profile.toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("profile.toasts.selectImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("profile.toasts.imageTooLarge"));
      return;
    }
    setUploading(true);
    try {
      await uploadAvatar(file);
      toast.success(t("profile.toasts.avatarUpdated"));
    } catch {
      toast.error(t("profile.toasts.avatarFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSetup2FA() {
    try {
      const { data } = await client.post("/auth/2fa/setup");
      setQrUri(data.uri);
      setRecoveryCodes(data.recoveryCodes);
      setShowRecoveryCodes(true);
      setIsTwoFactorConfigured(true);
      toast.success(t("profile.toasts.twoFactorSetup"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t("profile.toasts.twoFactorSetupFailed");
      toast.error(msg);
    }
  }

  async function handleEnable2FA() {
    if (setupCode.length !== 6) return;
    try {
      await client.post("/auth/2fa/enable", { code: setupCode });
      setIsTwoFactorEnabled(true);
      setSetupCode("");
      toast.success(t("profile.toasts.twoFactorEnabled"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t("profile.toasts.invalidCode");
      toast.error(msg);
    }
  }

  async function handleDisable2FA() {
    if (!passwordInput) return;
    try {
      await client.post("/auth/2fa/disable", { password: passwordInput });
      setIsTwoFactorEnabled(false);
      setIsTwoFactorConfigured(false);
      setQrUri("");
      setRecoveryCodes([]);
      setPasswordInput("");
      toast.success(t("profile.toasts.twoFactorDisabled"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t("profile.toasts.twoFactorDisableFailed");
      toast.error(msg);
    }
  }

  async function handleRegenerateRecoveryCodes() {
    if (!passwordInput) {
      toast.error(t("profile.toasts.enterPasswordFirst"));
      return;
    }
    try {
      const { data } = await client.post("/auth/2fa/recovery-codes", { password: passwordInput });
      setRecoveryCodes(data.recoveryCodes);
      setShowRecoveryCodes(true);
      toast.success(t("profile.toasts.codesGenerated"));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t("profile.toasts.codesGenerateFailed");
      toast.error(msg);
    }
  }

  async function handleAddIcs() {
    if (!icsName.trim() || !icsUrl.trim()) return;
    setAddingIcs(true);
    try {
      await addCalendar(icsName.trim(), icsUrl.trim(), icsColor);
      setIcsName("");
      setIcsUrl("");
      setIcsColor(ICS_COLORS[0]);
      toast.success("Calendar added");
    } catch {
      toast.error("Failed to add calendar");
    } finally {
      setAddingIcs(false);
    }
  }

  function handleDeleteIcs(id: string) {
    const cal = icsCalendars.find((c) => c.id === id);
    if (!confirm(t("profile.icsDeleteConfirm"))) return;
    removeCalendar(id);
  }

  function formatLastSync(dateStr: string | null): string {
    if (!dateStr) return t("profile.icsNever");
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const timezones = Intl.supportedValuesOf?.("timeZone") ?? [
    "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Madrid", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo",
    "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland",
  ];

  const tabs = [
    { id: "general" as const, label: t("profile.general") },
    { id: "security" as const, label: t("profile.security") },
    { id: "calendars" as const, label: t("profile.calendars") },
  ];

  return (
    <AppLayout title={t("profile.title")}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}
        className="mx-auto max-w-2xl p-4"
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div
                className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-xl font-bold text-primary transition-all duration-200 hover:brightness-95"
                onClick={() => fileRef.current?.click()}
              >
                {user?.avatarUrl ? (
                  <img
                    src={resolveImageUrl(user.avatarUrl)}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(user?.displayName || user?.username || "")
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-sm transition-colors hover:bg-teal-600 dark:border-gray-900"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <h1 className="font-outfit text-xl font-bold text-gray-900 dark:text-gray-100">
                {user?.displayName || user?.username}
              </h1>
              <p className="font-urbanist text-sm text-gray-500 dark:text-gray-400">
                @{user?.username}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-4 py-2 font-urbanist text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {activeTab === "general" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="mb-5 font-outfit text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("profile.personalInfo")}
            </h3>
            <div className="space-y-5">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.displayName")}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.username || t("profile.displayNamePlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.email")}
                </label>
                <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.notificationEmail")}
                </label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder={user?.email || t("profile.notificationEmailPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                <p className="mt-1.5 font-urbanist text-xs text-gray-400 dark:text-gray-500">
                  {t("profile.notificationEmailDesc")}
                </p>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.bio")}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("profile.bioPlaceholder")}
                  rows={3}
                  maxLength={500}
                  className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                <p className="mt-1 text-right font-urbanist text-xs text-gray-400 dark:text-gray-500">
                  {bio.length}/500
                </p>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.timezone")}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">{t("profile.autodetect")}</option>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="rounded-xl bg-primary px-6 py-2.5 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-60"
              >
                {saving ? t("common.saving") : t("profile.saveChanges")}
              </button>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">{t("profile.role")}</label>
                <span className="ml-2 rounded-full bg-gray-100 px-3 py-1 font-urbanist text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {user?.role}
                </span>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">{t("profile.language")}</label>
                <div className="ml-2 inline-flex gap-1">
                  {["en", "es"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { i18n.changeLanguage(lang); updateLanguage(lang); }}
                      className={`rounded-lg px-3 py-1 font-urbanist text-xs font-medium transition-colors ${
                        user?.language === lang
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {lang === "en" ? "EN" : "ES"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isNative() && (
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                <label className="mb-3 block font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("profile.fontSize")}
                </label>
                <div className="flex gap-2">
                  {FONT_SIZES.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleFontSizeChange(opt.value)}
                      className={`flex-1 rounded-lg px-3 py-2 font-urbanist text-xs font-medium transition-colors ${
                        currentFontSize === opt.value
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-urbanist text-sm text-gray-700 dark:text-gray-300">
                    {t("profile.boldFont")}
                  </span>
                  <button
                    onClick={handleBoldToggle}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      boldFont ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        boldFont ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="mb-4 font-outfit text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("profile.twoFactor.title")}
            </h3>

            {!isTwoFactorConfigured && !isTwoFactorEnabled && (
              <div>
                <p className="mb-4 font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {t("profile.twoFactor.description")}
                </p>
                <button
                  onClick={handleSetup2FA}
                  className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
                >
                  {t("profile.twoFactor.setup")}
                </button>
              </div>
            )}

            {isTwoFactorConfigured && !isTwoFactorEnabled && qrUri && (
              <div className="space-y-4">
                <p className="font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {t("profile.twoFactor.scanQRLong")}
                </p>
                <div className="flex justify-center">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                      alt={t("profile.twoFactor.title")}
                      className="h-48 w-48"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("profile.twoFactor.verificationCode")}
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("profile.twoFactor.verificationPlaceholder")}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-center tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <button
                      onClick={handleEnable2FA}
                      disabled={setupCode.length !== 6}
                      className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                    >
                      {t("profile.twoFactor.enable")}
                    </button>
                  </div>
                </div>
                {showRecoveryCodes && recoveryCodes.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/30">
                    <p className="mb-2 font-urbanist text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {t("profile.twoFactor.recoveryCodesTitle")}
                    </p>
                    <p className="mb-3 font-urbanist text-xs text-amber-700 dark:text-amber-400">
                      {t("profile.twoFactor.recoveryCodesDesc")}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {recoveryCodes.map((code, i) => (
                        <code key={i} className="font-mono text-sm font-medium text-amber-900 dark:text-amber-200">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isTwoFactorEnabled && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-urbanist text-sm font-medium text-green-700 dark:text-green-400">
                    {t("profile.twoFactor.enabled")}
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("profile.twoFactor.enterPassword")}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={t("profile.twoFactor.passwordPlaceholder")}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleDisable2FA}
                      disabled={!passwordInput}
                      className="rounded-xl bg-red-500 px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      {t("profile.twoFactor.disable")}
                    </button>
                    <button
                      onClick={handleRegenerateRecoveryCodes}
                      disabled={!passwordInput}
                      className="rounded-xl bg-gray-200 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      {t("profile.twoFactor.generateNewCodes")}
                    </button>
                  </div>
                </div>
                {showRecoveryCodes && recoveryCodes.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/30">
                    <p className="mb-2 font-urbanist text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {t("profile.twoFactor.recoveryCodesNewTitle")}
                    </p>
                    <p className="mb-3 font-urbanist text-xs text-amber-700 dark:text-amber-400">
                      {t("profile.twoFactor.recoveryCodesNewWarning")}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {recoveryCodes.map((code, i) => (
                        <code key={i} className="font-mono text-sm font-medium text-amber-900 dark:text-amber-200">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "calendars" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="mb-4 font-outfit text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("profile.icsTitle")}
            </h3>
            <p className="mb-5 font-urbanist text-sm text-gray-500 dark:text-gray-400">
              {t("profile.icsDesc")}
            </p>

            {/* Add form */}
            <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-urbanist text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("profile.icsName")}
                  </label>
                  <input
                    type="text"
                    value={icsName}
                    onChange={(e) => setIcsName(e.target.value)}
                    placeholder={t("profile.icsNamePlaceholder")}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-urbanist text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("profile.icsUrl")}
                  </label>
                  <input
                    type="url"
                    value={icsUrl}
                    onChange={(e) => setIcsUrl(e.target.value)}
                    placeholder={t("profile.icsUrlPlaceholder")}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-urbanist text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("profile.icsColor")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICS_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setIcsColor(color)}
                      className={`h-7 w-7 rounded-full transition-all ${icsColor === color ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900" : ""}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleAddIcs}
                disabled={addingIcs || !icsName.trim() || !icsUrl.trim()}
                className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
              >
                {addingIcs ? t("common.saving") : t("profile.icsAdd")}
              </button>
            </div>

            {/* List of calendars */}
            <div className="mt-6">
              <h4 className="mb-3 font-urbanist text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t("profile.icsAdd")}
              </h4>
              {icsCalendars.length === 0 ? (
                <p className="font-urbanist text-sm text-gray-400 dark:text-gray-500">
                  {t("profile.icsNoCalendars")}
                </p>
              ) : (
                <div className="space-y-3">
                  {icsCalendars.map((cal) => (
                    <div
                      key={cal.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cal.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-urbanist text-sm font-medium text-gray-900 dark:text-gray-100">
                          {cal.name}
                        </p>
                        <p className="truncate font-urbanist text-xs text-gray-400 dark:text-gray-500">
                          {cal.url}
                        </p>
                        <p className="font-urbanist text-xs text-gray-400 dark:text-gray-500">
                          {t("profile.icsLastSync", { time: formatLastSync(cal.lastSyncedAt) })}
                        </p>
                      </div>
                      <button
                        onClick={() => syncCalendar(cal.id)}
                        disabled={syncing.has(cal.id)}
                        className="rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                      >
                        {syncing.has(cal.id) ? (
                          <span className="flex items-center gap-1">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            {t("profile.icsSyncing")}
                          </span>
                        ) : (
                          t("profile.icsSyncNow")
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteIcs(cal.id)}
                        className="rounded-lg px-3 py-1.5 font-urbanist text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {t("profile.icsDelete")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About section */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        <h2 className="mb-3 font-outfit text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t("profile.about") || "About"}
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
              {t("profile.version") || "Version"}
            </span>
            <span className="font-urbanist text-xs text-gray-900 dark:text-gray-100">
              v{appVersion}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-urbanist text-xs text-gray-500 dark:text-gray-400">
              {t("profile.buildDate") || "Build date"}
            </span>
            <span className="font-urbanist text-xs text-gray-900 dark:text-gray-100">
              {new Date(__BUILD_TIME__).toLocaleString()}
            </span>
          </div>
          {isNative() && (<>
            <button
              onClick={async () => {
                try {
                  const pending = await LocalNotifications.getPending();
                  toast.success(
                    `${t("profile.pendingNotifs") || "Pending notifications"}: ${pending.notifications.length}`,
                    { duration: 5000 }
                  );
                  console.log("[profile] pending notifications:", pending.notifications);
                } catch (err) {
                  toast.error("Error checking notifications");
                  console.error("[profile]", err);
                }
              }}
              className="mt-2 w-full rounded-lg bg-gray-100 px-3 py-2 font-urbanist text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t("profile.checkNotifs") || "Diagnose notifications"}
            </button>
            <button
              onClick={async () => {
                const ok = await scheduleTestNotification();
                if (ok) {
                  toast.success("Test notification in 10s", { duration: 3000 });
                } else {
                  toast.error("Failed to schedule test");
                }
              }}
              className="mt-2 w-full rounded-lg bg-primary px-3 py-2 font-urbanist text-xs font-medium text-white transition-colors hover:bg-teal-600"
            >
              {t("profile.testNotif") || "Test notification (10s)"}
            </button>
          </>)}
        </div>
      </div>
      </motion.div>
    </AppLayout>
  );
}
