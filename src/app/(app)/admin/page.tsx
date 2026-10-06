import {
  CalendarCogIcon,
  ClipboardListIcon,
  HistoryIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StethoscopeIcon,
  TrophyIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Capability } from "@/lib/permissions";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

const LINKS: { href: string; title: string; text: string; icon: React.ElementType; caps: Capability[] }[] = [
  { href: "/admin/devices", title: "Device approvals", text: "Approve or remove members' check-in phones", icon: ShieldCheckIcon, caps: ["devices.approve"] },
  { href: "/admin/leave", title: "Medical leave", text: "Approve medical leave requests", icon: StethoscopeIcon, caps: ["leave.approve"] },
  { href: "/admin/meetings", title: "Meetings", text: "Schedule weekly meetings and times", icon: CalendarCogIcon, caps: ["meetings.manage"] },
  { href: "/admin/attendance", title: "Attendance & PALMS", text: "Past meetings, PALMS summaries, follow-ups", icon: ClipboardListIcon, caps: ["palms.view", "meeting.finalize"] },
  { href: "/admin/venues", title: "Venues", text: "Meeting places and addresses", icon: MapPinIcon, caps: ["meetings.manage"] },
  { href: "/admin/members", title: "Members", text: "Roster, add members, import CSV", icon: UsersIcon, caps: ["members.manage"] },
  { href: "/admin/roles", title: "Roles & terms", text: "Who holds which role this term", icon: UserCogIcon, caps: ["roles.manage"] },
  { href: "/admin/awards", title: "Weekly recognitions", text: "Pick this week's winners", icon: TrophyIcon, caps: ["awards.manage"] },
  { href: "/admin/calendar", title: "Calendar", text: "Events, trainings, presentation slots", icon: CalendarCogIcon, caps: ["calendar.manage", "calendar.manage.feature_presentation", "calendar.manage.education_slot", "calendar.manage.event", "calendar.manage.training"] },
  { href: "/admin/feedback", title: "Suggestions & feedback", text: "Read and reply to members' suggestions", icon: MessageSquareTextIcon, caps: ["feedback.manage"] },
  { href: "/admin/settings", title: "Settings", text: "Attendance rules and member sign-in", icon: SlidersHorizontalIcon, caps: ["settings.manage"] },
  { href: "/admin/audit", title: "Audit log", text: "Who changed what, and why", icon: HistoryIcon, caps: ["audit.view"] },
];

export default async function AdminPage() {
  const me = await requireMember();
  const links = LINKS.filter((l) => l.caps.some((c) => me.caps.has(c)));
  return (
    <PageContainer wide>
      <PageHeader title="Admin" description="Tools for the chapter leadership team." />
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don&apos;t have admin roles this term.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, title, text, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-3 py-4">
                  <Icon className="mt-0.5 size-5 text-primary" />
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">{text}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
