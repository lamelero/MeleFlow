import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";

const languages = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const updateLanguage = useAuthStore((s) => s.updateLanguage);

  function toggleLanguage() {
    const currentIndex = languages.findIndex((l) => l.code === i18n.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    const nextLang = languages[nextIndex].code;
    i18n.changeLanguage(nextLang);
    updateLanguage(nextLang);
  }

  return (
    <button
      onClick={toggleLanguage}
      className="rounded-xl bg-gray-100 px-3 py-1.5 font-urbanist text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
      title={t("usermenu.language")}
    >
      {i18n.language === "es" ? "EN" : "ES"}
    </button>
  );
}
