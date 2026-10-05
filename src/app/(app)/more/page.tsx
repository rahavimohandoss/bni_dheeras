import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NavIcon } from "@/components/nav-icon";
import { SECONDARY_NAV, STAFF_NAV, visible } from "@/components/nav-items";
import { PageContainer } from "@/components/page-header";
import { SignOutButton } from "@/components/user-menu";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const me = await requireMember();
  const staff = STAFF_NAV.filter((i) => visible(i, me.caps));
  return (
    <PageContainer>
      <h1 className="mb-4 text-2xl font-bold">More</h1>
      <div className="divide-y rounded-xl border">
        {[...SECONDARY_NAV, ...staff].map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50">
            <NavIcon name={item.icon} className="size-5 text-primary" />
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
      <SignOutButton className="mt-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 font-medium text-destructive" />
    </PageContainer>
  );
}
