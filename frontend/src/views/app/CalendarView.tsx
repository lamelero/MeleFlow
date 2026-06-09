import { useTranslation } from "react-i18next";
import AppLayout from "../../components/AppLayout";
import CalendarContent from "../../components/calendar/CalendarContent";

export default function CalendarView() {
  const { t } = useTranslation();

  return (
    <AppLayout title={t("calendar.title")}>
      <CalendarContent standalone />
    </AppLayout>
  );
}
