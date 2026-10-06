"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAwards, unpublishAwards } from "@/actions/awards";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Entry = { awardTypeId: string; memberId: string; note: string; value: string; published?: boolean };
type AwardTypeOption = { id: string; name: string; noteEnabled: boolean; valueEnabled: boolean; valueHint: string | null };
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
  types: AwardTypeOption[];
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
    saveAwards(
      meetingId,
      entries.map(({ awardTypeId, memberId, note, value }) => ({ awardTypeId, memberId, note, value })),
      publish,
    );

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
        const extras = Number(t.noteEnabled) + Number(t.valueEnabled);
        return (
          <Card key={t.id}>
            <CardContent
              className={cn(
                "grid gap-3 py-4",
                extras === 2 ? "sm:grid-cols-[1fr_1fr_160px]" : extras === 1 ? "sm:grid-cols-2" : "sm:grid-cols-1",
              )}
            >
              <div className="font-semibold sm:col-span-full">{t.name}</div>
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
              {t.noteEnabled ? (
                <Input placeholder="Note (optional)" value={e.note} onChange={(ev) => update(t.id, { note: ev.target.value })} />
              ) : null}
              {t.valueEnabled ? (
                <Input
                  placeholder={t.valueHint ?? "Value"}
                  value={e.value}
                  onChange={(ev) => update(t.id, { value: ev.target.value })}
                />
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {published ? (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await save(true);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Saved. Anyone newly added has been notified.");
                  router.refresh();
                })
              }
            >
              Save changes
            </Button>
            <ConfirmButton
              label="Unpublish"
              title="Unpublish this week's recognitions?"
              description="Members won't see them until you publish again."
              success="Unpublished."
              action={() => unpublishAwards(meetingId)}
              variant="outline"
              size="default"
            />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await save(false);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Draft saved.");
                  router.refresh();
                })
              }
            >
              Save draft
            </Button>
            <ConfirmButton
              label="Publish"
              title="Publish this week's recognitions?"
              description="Everyone can see them, and each winner gets a notification."
              success="Published. Winners have been notified."
              action={() => save(true)}
              variant="default"
              size="default"
              destructive={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
