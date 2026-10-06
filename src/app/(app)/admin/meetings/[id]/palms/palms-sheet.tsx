"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { savePalms } from "@/actions/palms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/attendance/rules";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/time";

type Row = {
  id: string;
  name: string;
  category: string | null;
  status: AttendanceStatus | "";
  method: string | null;
  at: string | null;
  substitute: string | null;
  leave: "medical" | "informed" | null;
};

/** One tap per member: P, A, L, M or S for the whole chapter, then Save. */
export function PalmsSheet({ meetingId, members, hasRecords }: { meetingId: string; members: Row[]; hasRecords: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Record<string, AttendanceStatus | "">>(
    Object.fromEntries(members.map((m) => [m.id, m.status])),
  );
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const changed = members.filter((m) => picked[m.id] !== m.status).length;
  const tally = (s: AttendanceStatus) => members.filter((m) => picked[m.id] === s).length;
  const setAll = (status: AttendanceStatus | "") => setPicked(Object.fromEntries(members.map((m) => [m.id, status])));

  const save = () =>
    start(async () => {
      const res = await savePalms({
        meetingId,
        reason,
        rows: members.map((m) => ({ memberId: m.id, status: picked[m.id] })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.changed === 0 ? "Nothing to save." : `Saved. ${res.data.changed} member(s) updated.`);
      setReason("");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Quick fill:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("P")}>
          Everyone present
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("")}>
          Clear all
        </Button>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {ATTENDANCE_STATUSES.map((s) => `${s} ${tally(s)}`).join(" · ")}
        </span>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {members.map((m, i) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[
                  m.category,
                  m.substitute ? `Substitute: ${m.substitute}` : null,
                  m.leave === "medical" ? "Medical leave approved" : m.leave === "informed" ? "Informed absence" : null,
                  m.method === "self_qr" && m.at ? `Checked in ${formatTime(new Date(m.at))}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex gap-1">
              {ATTENDANCE_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="icon-sm"
                  variant={picked[m.id] === s ? "default" : "outline"}
                  aria-label={`${m.name}: ${STATUS_LABELS[s]}`}
                  aria-pressed={picked[m.id] === s}
                  onClick={() => setPicked((p) => ({ ...p, [m.id]: p[m.id] === s ? "" : s }))}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ))}
        {members.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No members yet.</p> : null}
      </div>

      <div className={cn("sticky bottom-20 z-10 space-y-2 rounded-xl border bg-card p-3 shadow-lg lg:bottom-4")}>
        {hasRecords ? (
          <div className="space-y-1.5">
            <Label htmlFor="palms-reason">Reason for the change</Label>
            <Input
              id="palms-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. entered from the paper sheet"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {changed === 0 ? "No changes yet" : `${changed} member(s) changed`}
          </span>
          <Button className="ml-auto" disabled={pending || changed === 0} onClick={save}>
            Save PALMS
          </Button>
        </div>
      </div>
    </div>
  );
}
