import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { CelebrationRow } from "@/components/celebration-row";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { member } from "@/db/schema";
import { getCelebrations, isToday, MONTH_NAMES, today } from "@/lib/celebrations";
import { requireCapPage } from "@/lib/session";

export const metadata: Metadata = { title: "Celebrations" };

/** Head Table: every member's birthday and wedding anniversary, month by month from this month. */
export default async function CelebrationsPage() {
  await requireCapPage("celebrations.view");
  const now = today();
  const [all, [{ members }]] = await Promise.all([
    getCelebrations(),
    db
      .select({ members: count() })
      .from(member)
      .where(and(eq(member.status, "active"), eq(member.isChapterMember, true))),
  ]);
  const withBirthday = new Set(all.filter((c) => c.kind === "birthday").map((c) => c.memberId)).size;
  const months = Array.from({ length: 12 }, (_, i) => ((now.month - 1 + i) % 12) + 1);

  return (
    <PageContainer>
      <PageHeader
        title="Celebrations"
        back={{ href: "/", label: "Home" }}
        description={`${withBirthday} of ${members} members have added their birthday in My profile.`}
      />
      <div className="space-y-4">
        {months.map((month) => {
          const list = all.filter((c) => c.month === month);
          return (
            <Card key={month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {MONTH_NAMES[month - 1]}
                  {month === now.month ? <span className="ml-2 text-sm font-normal text-muted-foreground">this month</span> : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No birthdays or anniversaries.</p>
                ) : (
                  <div className="space-y-0.5">
                    {list.map((c) => (
                      <CelebrationRow key={`${c.memberId}-${c.kind}`} c={c} today={isToday(c, now)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
