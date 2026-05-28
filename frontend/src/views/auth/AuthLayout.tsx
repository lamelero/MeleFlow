import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-outfit text-3xl font-bold text-primary">
            {t("auth.taskflow")}
          </h1>
          <p className="mt-1 font-urbanist text-sm text-gray-500">
            {t("auth.taskflowTagline")}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}
