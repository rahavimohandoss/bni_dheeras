import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { MarkAllRead } from "./mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const me = await requireMember();
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.memberId, me.id))
    .orderBy(desc(notification.createdAt))
    .limit(100);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <PageContainer>
      <PageHeader title="Notifications" actions={unread ? <MarkAllRead /> : null} />
      {rows.length === 0 ? (
        <EmptyState title="You're all caught up." />
      ) : (
        <div className="divide-y rounded-xl border">
          {rows.map((n) => {
            const body = (
              <div className={cn("px-4 py-3", !n.readAt && "bg-primary/5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}</div>
                  <div className="shrink-0 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                </div>
                {n.body ? <div className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{n.body}</div> : null}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

