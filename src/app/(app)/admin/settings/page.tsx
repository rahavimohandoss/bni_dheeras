import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { getDefaultPassword } from "@/lib/passwords";
import { requireCapPage } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { AttendanceSettingsForm } from "./attendance-settings-form";
import { DefaultPasswordForm } from "./default-password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireCapPage("settings.manage");
  const [settings, defaultPassword] = await Promise.all([getAttendanceSettings(), getDefaultPassword()]);
  return (
    <PageContainer>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <h2 className="mb-2 font-semibold">Attendance rules</h2>
      <AttendanceSettingsForm initial={settings} lateFlagWeeks={settings.lateFlagWeeks} />
      <h2 className="mt-6 mb-2 font-semibold">Member sign-in</h2>
      <DefaultPasswordForm initial={defaultPassword} />
    </PageContainer>
  );
}
