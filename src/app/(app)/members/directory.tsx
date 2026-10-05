"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = { id: string; name: string; business: string | null; category: string | null; photoUrl: string | null };

export function Directory({ members }: { members: Row[] }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => [m.name, m.business, m.category].some((v) => v?.toLowerCase().includes(q))) : members;
  }, [members, query]);
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name, business or category (e.g. plumber)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
          <Link key={m.id} href={`/members/${m.id}`}>
            <Card className="h-full hover:border-primary/40">
              <CardContent className="flex items-center gap-3 py-3">
                <MemberAvatar name={m.name} src={m.photoUrl} className="size-12" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{m.name}</div>
                  <div className="truncate text-sm">{m.business}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.category}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">No members match &quot;{query}&quot;.</p> : null}
    </div>
  );
}
