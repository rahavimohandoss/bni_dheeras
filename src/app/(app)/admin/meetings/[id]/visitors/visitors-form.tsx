"use client";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveVisitors } from "@/actions/visitors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type VisitorRow = { name: string; phone: string; business: string; category: string; invitedById: string; note: string };

const BLANK: VisitorRow = { name: "", phone: "", business: "", category: "", invitedById: "", note: "" };
const NOBODY = "__none";

/** Count the visitors at the door, then fill in as many details as you have. */
export function VisitorsForm({
  meetingId,
  count: initialCount,
  visitors,
  members,
}: {
  meetingId: string;
  count: number;
  visitors: VisitorRow[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [count, setCount] = useState(Math.max(initialCount, visitors.length));
  // One card per visitor counted, so the details follow the number entered.
  const [rows, setRows] = useState<VisitorRow[]>(() =>
    Array.from({ length: Math.max(initialCount, visitors.length) }, (_, i) => visitors[i] ?? { ...BLANK }),
  );
  const [pending, start] = useTransition();

  const setCountTo = (next: number) => {
    const n = Math.max(0, Math.min(100, next));
    setCount(n);
    setRows((list) => (n <= list.length ? list.slice(0, Math.max(n, filled(list))) : [...list, ...Array.from({ length: n - list.length }, () => ({ ...BLANK }))]));
  };
  const update = (i: number, patch: Partial<VisitorRow>) =>
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const named = rows.filter((r) => r.name.trim().length >= 2).length;

  const save = () =>
    start(async () => {
      const res = await saveVisitors({ meetingId, count, visitors: rows });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.saved ? `Saved. ${res.data.saved} visitor(s) with details.` : "Visitor count saved.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Label htmlFor="visitor-count" className="font-semibold">
            Visitors at this meeting
          </Label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-sm" aria-label="One visitor less" onClick={() => setCountTo(count - 1)}>
              <MinusIcon />
            </Button>
            <Input
              id="visitor-count"
              className="w-16 text-center tabular-nums"
              inputMode="numeric"
              value={String(count)}
              onChange={(e) => setCountTo(Number(e.target.value.replace(/\D/g, "")) || 0)}
            />
            <Button type="button" variant="outline" size="icon-sm" aria-label="One more visitor" onClick={() => setCountTo(count + 1)}>
              <PlusIcon />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {named} of {rows.length} have details. The count is what goes into PALMS.
          </p>
        </CardContent>
      </Card>

      {rows.map((r, i) => (
        <Card key={i}>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Visitor {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={`Remove visitor ${i + 1}`}
                onClick={() => {
                  setRows((list) => list.filter((_, j) => j !== i));
                  setCount((c) => Math.max(0, c - 1));
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Visitor's name" />
              </Field>
              <Field label="Mobile">
                <Input value={r.phone} onChange={(e) => update(i, { phone: e.target.value })} inputMode="tel" placeholder="98400 12345" />
              </Field>
              <Field label="Business">
                <Input value={r.business} onChange={(e) => update(i, { business: e.target.value })} />
              </Field>
              <Field label="Category">
                <Input value={r.category} onChange={(e) => update(i, { category: e.target.value })} placeholder="e.g. Architect" />
              </Field>
              <Field label="Invited by">
                <Select
                  value={r.invitedById || NOBODY}
                  onValueChange={(v) => update(i, { invitedById: v === NOBODY ? "" : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nobody" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOBODY}>Not recorded</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Note">
                <Input value={r.note} onChange={(e) => update(i, { note: e.target.value })} placeholder="e.g. wants to join" />
              </Field>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg lg:bottom-4">
        <Button type="button" variant="outline" onClick={() => setCountTo(count + 1)}>
          <PlusIcon /> Add visitor
        </Button>
        <Button className="ml-auto" disabled={pending} onClick={save}>
          Save visitors
        </Button>
      </div>
    </div>
  );
}

function filled(rows: VisitorRow[]) {
  let last = 0;
  rows.forEach((r, i) => {
    if (r.name.trim()) last = i + 1;
  });
  return last;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
