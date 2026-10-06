"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { type NavItem, PRIMARY_NAV, SECONDARY_NAV, STAFF_NAV, visible } from "@/components/nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <NavIcon name={item.icon} className={cn("size-5", item.icon === "scan" && "size-6")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav({ caps }: { caps: string[] }) {
  const pathname = usePathname();
  const set = new Set(caps);
  const items: NavItem[] = [
    ...PRIMARY_NAV.filter((i) => i.href !== "/more"),
    ...SECONDARY_NAV.filter((i) => ["/members", "/awards", "/feedback"].includes(i.href)),
    ...STAFF_NAV.filter((i) => visible(i, set)),
  ];
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm font-medium",
            isActive(pathname, item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
