"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCalendarEvent, saveCalendarEvent } from "@/actions/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Kind = "event" | "training" | "feature_presentation" | "education_slot" | "other";
type EventRow = {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  link: string;
  memberId: string;
};

const NONE = "__none";

export function CalendarAdmin({
  kinds,
  members,
  events,
}: {
  kinds: { key: Kind; label: string }[];
  members: { id: string; name: string }[];
  events: EventRow[];
}) {
  const [editing, setEditing] = useState<EventRow | null>(null);
  const blank: EventRow = {
    id: "",
    kind: kinds[0].key,
    title: "",
    description: "",
    date: "",
    startTime: "07:00",
    endTime: "08:00",
    location: "",
    link: "",
    memberId: "",
  };
  const labelOf = (k: Kind) => kinds.find((x) => x.key === k)?.label ?? k;

  return (
    <div className="space-y-4">
      {editing ? (
        <EventForm key={editing.id || "new"} row={editing} kinds={kinds} members={members} onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing(blank)}>
          <PlusIcon /> Add to calendar
        </Button>
      )}
      <div className="divide-y rounded-xl border">
        {events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.title}</div>
              <div className="text-sm text-muted-foreground">
                {e.date} · {e.startTime}–{e.endTime}
                {e.memberId ? ` · ${members.find((m) => m.id === e.memberId)?.name ?? ""}` : ""}
              </div>
            </div>
            <Badge variant="secondary">{labelOf(e.kind)}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
              Edit
            </Button>
            <DeleteButton id={e.id} />
          </div>
        ))}
        {events.length === 0 ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet.</div> : null}
      </div>
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this calendar item?")) return;
        start(async () => {
          const res = await deleteCalendarEvent(id);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      Delete
    </Button>
  );
}

function EventForm({
  row,
  kinds,
  members,
  onDone,
}: {
  row: EventRow;
  kinds: { key: Kind; label: string }[];
  members: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [v, setV] = useState(row);
  const [pending, start] = useTransition();
  const set = <K extends keyof EventRow>(k: K, value: EventRow[K]) => setV((s) => ({ ...s, [k]: value }));
  const isSlot = v.kind === "feature_presentation" || v.kind === "education_slot";

  return (
    <Card>
      <CardContent className="py-4">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const { id, ...input } = v;
              const res = await saveCalendarEvent(id || null, input);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Saved.");
              onDone();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={v.kind} onValueChange={(x) => set("kind", x as Kind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k.key} value={k.key}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" value={v.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{isSlot ? "Presenter" : "Member (optional)"}</Label>
            <Select value={v.memberId || NONE} onValueChange={(x) => set("memberId", x === NONE ? "" : x)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nobody" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nobody</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">Date</Label>
            <Input id="ev-date" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Starts</Label>
              <Input id="ev-start" type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">Ends</Label>
              <Input id="ev-end" type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input id="ev-loc" value={v.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ev-link">Link (optional)</Label>
            <Input id="ev-link" value={v.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ev-desc">Details</Label>
            <Textarea id="ev-desc" value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
