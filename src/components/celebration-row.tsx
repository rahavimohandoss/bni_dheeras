import { CakeIcon, HeartIcon } from "lucide-react";
import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import type { Celebration } from "@/lib/celebrations";
import { MONTH_NAMES } from "@/lib/celebrations";

/** One birthday or anniversary: who, what, and the day of the month. */
export function CelebrationRow({ c, today }: { c: Celebration; today: boolean }) {
  const Icon = c.kind === "birthday" ? CakeIcon : HeartIcon;
  return (
    <Link href={`/members/${c.memberId}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/60">
      <MemberAvatar name={c.name} src={c.photoUrl} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="size-3.5 text-primary" /> {c.kind === "birthday" ? "Birthday" : "Wedding anniversary"}
        </div>
      </div>
      {today ? <Badge>Today</Badge> : null}
      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {c.day} {MONTH_NAMES[c.month - 1].slice(0, 3)}
      </span>
    </Link>
  );
}
