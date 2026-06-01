import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { client } from "../../api/client";
import ThemeToggle from "../../components/ThemeToggle";
import LanguageSwitcher from "../../components/LanguageSwitcher";

export default function Profile() {
  const { t } = useTranslation();
  const { user, updateLanguage, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"general" | "security">("general");

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

  async function fetch2FAStatus() {
    try {
      const { data } = await client.get("/auth/2fa/status");
      setIsTwoFactorEnabled(data.isTwoFactorEnabled);
      setIsTwoFactorConfigured(data.isConfigured);
    } catch {
      // ignore
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

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "security" as const, label: "Security" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-outfit text-xl font-bold text-gray-900 dark:text-gray-100">
          Profile Settings
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
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
        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
          <div>
            <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>
          <div>
            <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">{user?.username}</p>
          </div>
          <div>
            <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <p className="mt-1 font-urbanist text-sm text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
          <div>
            <label className="font-urbanist text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
            <div className="mt-1 flex gap-2">
              {["en", "es"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => updateLanguage(lang)}
                  className={`rounded-lg px-3 py-1.5 font-urbanist text-sm font-medium transition-colors ${
                    user?.language === lang
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {lang === "en" ? "English" : "Español"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-6">
          {/* 2FA Section */}
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
  );
}
