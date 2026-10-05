"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAwards } from "@/actions/awards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Entry = { awardTypeId: string; memberId: string; note: string; value: string; published?: boolean };
const NONE = "__none";

export function AwardsEditor({
  meetings,
  meetingId,
  types,
  members,
  initial,
}: {
  meetings: { id: string; label: string }[];
  meetingId: string;
  types: { id: string; name: string }[];
  members: { id: string; name: string }[];
  initial: Entry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>(
    types.map((t) => initial.find((i) => i.awardTypeId === t.id) ?? { awardTypeId: t.id, memberId: "", note: "", value: "" }),
  );
  const [pending, start] = useTransition();
  const published = initial.some((i) => i.published);
  const update = (typeId: string, patch: Partial<Entry>) =>
    setEntries((list) => list.map((e) => (e.awardTypeId === typeId ? { ...e, ...patch } : e)));

  const save = (publish: boolean) =>
    start(async () => {
      const res = await saveAwards(
        meetingId,
        entries.map(({ awardTypeId, memberId, note, value }) => ({ awardTypeId, memberId, note, value })),
        publish,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(publish ? "Published. Winners have been notified." : "Draft saved.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Meeting</Label>
        <Select value={meetingId} onValueChange={(id) => router.push(`/admin/awards?meeting=${id}`)}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meetings.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {published ? <Badge>Published</Badge> : <Badge variant="outline">Not published</Badge>}
      </div>

      {types.map((t) => {
        const e = entries.find((x) => x.awardTypeId === t.id)!;
        return (
          <Card key={t.id}>
            <CardContent className="grid gap-3 py-4 sm:grid-cols-[1fr_1fr_140px]">
              <div className="space-y-1.5 sm:col-span-3">
                <div className="font-semibold">{t.name}</div>
              </div>
              <Select value={e.memberId || NONE} onValueChange={(v) => update(t.id, { memberId: v === NONE ? "" : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No winner this week</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Note (optional)" value={e.note} onChange={(ev) => update(t.id, { note: ev.target.value })} />
              <Input
                placeholder="Value (e.g. 4 referrals)"
                value={e.value}
                onChange={(ev) => update(t.id, { value: ev.target.value })}
              />
            </CardContent>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={() => save(false)}>
          Save draft
        </Button>
        <Button disabled={pending} onClick={() => save(true)}>
          Publish
        </Button>
      </div>
    </div>
  );
}
