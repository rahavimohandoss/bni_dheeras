import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireCapPage } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { AttendanceSettingsForm } from "./attendance-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireCapPage("settings.manage");
  const settings = await getAttendanceSettings();
  return (
    <PageContainer>
      <PageHeader title="Settings" back={{ href: "/admin", label: "Admin" }} />
      <h2 className="mb-2 font-semibold">Attendance rules</h2>
      <AttendanceSettingsForm initial={settings} />
      <Card className="mt-6">
        <CardContent className="flex items-center justify-between py-4 text-sm">
          <span>1-to-1 dance card template</span>
          <Link className="text-primary underline" href="/admin/settings/dance-card">
            Edit template
          </Link>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
