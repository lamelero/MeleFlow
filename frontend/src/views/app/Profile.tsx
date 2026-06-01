import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { client } from "../../api/client";
import AppLayout from "../../components/AppLayout";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateLanguage, updateProfile, uploadAvatar } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"general" | "security">("general");
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

  useEffect(() => {
    fetch2FAStatus();
  }, []);

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
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
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
      toast.success("2FA setup initiated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to setup 2FA";
      toast.error(msg);
    }
  }

  async function handleEnable2FA() {
    if (setupCode.length !== 6) return;
    try {
      await client.post("/auth/2fa/enable", { code: setupCode });
      setIsTwoFactorEnabled(true);
      setSetupCode("");
      toast.success("2FA enabled successfully");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Invalid code";
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
      toast.success("2FA disabled");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to disable 2FA";
      toast.error(msg);
    }
  }

  async function handleRegenerateRecoveryCodes() {
    if (!passwordInput) {
      toast.error("Enter your password first");
      return;
    }
    try {
      const { data } = await client.post("/auth/2fa/recovery-codes", { password: passwordInput });
      setRecoveryCodes(data.recoveryCodes);
      setShowRecoveryCodes(true);
      toast.success("New recovery codes generated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to generate codes";
      toast.error(msg);
    }
  }

  const timezones = Intl.supportedValuesOf?.("timeZone") ?? [
    "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Madrid", "Europe/Berlin", "Europe/Paris", "Asia/Tokyo",
    "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland",
  ];

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "security" as const, label: "Security" },
  ];

  return (
    <AppLayout title="Profile">
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
                    src={user.avatarUrl}
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
              Personal Info
            </h3>
            <div className="space-y-5">
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={user?.username || "Your display name"}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder={user?.email || "email@example.com"}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                />
                <p className="mt-1.5 font-urbanist text-xs text-gray-400 dark:text-gray-500">
                  Separate email for task reminders. Leave blank to use your account email.
                </p>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A few words about yourself..."
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
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Auto-detect</option>
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
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <span className="ml-2 rounded-full bg-gray-100 px-3 py-1 font-urbanist text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {user?.role}
                </span>
              </div>
              <div>
                <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                <div className="ml-2 inline-flex gap-1">
                  {["en", "es"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => updateLanguage(lang)}
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
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="mb-4 font-outfit text-base font-semibold text-gray-900 dark:text-gray-100">
              Two-Factor Authentication (2FA)
            </h3>

            {!isTwoFactorConfigured && !isTwoFactorEnabled && (
              <div>
                <p className="mb-4 font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  Add an extra layer of security to your account by enabling 2FA.
                </p>
                <button
                  onClick={handleSetup2FA}
                  className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600"
                >
                  Setup 2FA
                </button>
              </div>
            )}

            {isTwoFactorConfigured && !isTwoFactorEnabled && qrUri && (
              <div className="space-y-4">
                <p className="font-urbanist text-sm text-gray-500 dark:text-gray-400">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
                  then enter the 6-digit code below to enable.
                </p>
                <div className="flex justify-center">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                      alt="2FA QR Code"
                      className="h-48 w-48"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm text-center tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <button
                      onClick={handleEnable2FA}
                      disabled={setupCode.length !== 6}
                      className="rounded-xl bg-primary px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                    >
                      Enable
                    </button>
                  </div>
                </div>
                {showRecoveryCodes && recoveryCodes.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/30">
                    <p className="mb-2 font-urbanist text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Recovery Codes — Save these safely!
                    </p>
                    <p className="mb-3 font-urbanist text-xs text-amber-700 dark:text-amber-400">
                      Each code can be used only once. Store them in a secure location.
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
                    2FA is enabled
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enter your password to disable 2FA or manage recovery codes
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Your password"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-urbanist text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleDisable2FA}
                      disabled={!passwordInput}
                      className="rounded-xl bg-red-500 px-4 py-2 font-urbanist text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      Disable 2FA
                    </button>
                    <button
                      onClick={handleRegenerateRecoveryCodes}
                      disabled={!passwordInput}
                      className="rounded-xl bg-gray-200 px-4 py-2 font-urbanist text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Generate new recovery codes
                    </button>
                  </div>
                </div>
                {showRecoveryCodes && recoveryCodes.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/30">
                    <p className="mb-2 font-urbanist text-sm font-semibold text-amber-800 dark:text-amber-300">
                      New Recovery Codes
                    </p>
                    <p className="mb-3 font-urbanist text-xs text-amber-700 dark:text-amber-400">
                      Save these immediately. They won't be shown again.
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
      </motion.div>
    </AppLayout>
  );
}
