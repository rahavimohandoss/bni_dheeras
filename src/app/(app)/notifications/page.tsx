import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { clearReadNotifications } from "@/actions/notifications";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { MarkAllRead } from "./mark-all-read";
import { NotificationItem } from "./notification-item";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const me = await requireMember();
  const mine = eq(notification.memberId, me.id);
  const [[{ total }], [{ unread }], [{ read }]] = await Promise.all([
    db.select({ total: count() }).from(notification).where(mine),
    db.select({ unread: count() }).from(notification).where(and(mine, isNull(notification.readAt))),
    db.select({ read: count() }).from(notification).where(and(mine, isNotNull(notification.readAt))),
  ]);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const rows = await db
    .select()
    .from(notification)
    .where(mine)
    .orderBy(desc(notification.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        actions={
          <div className="flex gap-1">
            {unread ? <MarkAllRead /> : null}
            {read ? (
              <ConfirmButton
                label="Clear read"
                title={`Delete ${read} read notification${read > 1 ? "s" : ""}?`}
                success="Cleared."
                action={clearReadNotifications}
                variant="outline"
              />
            ) : null}
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="You're all caught up." />
      ) : (
        <div className="divide-y rounded-xl border">
          {rows.map((n) => (
            <NotificationItem
              key={n.id}
              n={{ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.readAt, when: formatDateTime(n.createdAt) }}
            />
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/notifications", {}, p)} />
    </PageContainer>
  );
}
