import { and, count, eq, isNull } from "drizzle-orm";
import { BellIcon } from "lucide-react";
import Link from "next/link";
import { BottomNav, DesktopNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-logo";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireMember();
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notification)
    .where(and(eq(notification.memberId, me.id), isNull(notification.readAt)));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="shrink-0">
            <BrandLogo height={44} preload />
          </Link>
          <div className="ml-2 flex-1">
            <DesktopNav caps={[...me.caps]} />
          </div>
          <Link href="/notifications" className="relative rounded-full p-2 text-muted-foreground hover:text-foreground">
            <BellIcon className="size-5" />
            {unread > 0 ? (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
            <span className="sr-only">Notifications</span>
          </Link>
          <UserMenu name={me.fullName} email={me.email} photoUrl={publicUrl(me.photoKey)} />
        </div>
      </header>
      <main className="pb-safe-nav flex-1 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
