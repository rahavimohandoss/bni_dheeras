"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  PhoneIcon,
  QrCodeIcon,
  RefreshCwIcon,
  UserCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { scanMemberPass } from "@/actions/checkin";
import { lvhConfirmSubstitute, lvhFinalize, lvhManualCheckin, lvhRemoveCheckin } from "@/actions/lvh";
import { MemberAvatar } from "@/components/member-avatar";
import { QrScanner } from "@/components/qr-scanner";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitorCounter } from "@/components/visitor-counter";
import { REJECTION_MESSAGES } from "@/lib/attendance/rules";
import type { BoardData, BoardMember } from "@/lib/attendance/board";
import { formatTime } from "@/lib/time";

type Feed = BoardData & {
  meeting: {
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string;
    graceMinutes: number | null;
    mode: string;
    headcount: number | null;
  };
};

const FLAG_LABELS: Record<string, string> = {
  same_phone_burst: "Same phone/network as another check-in",
};

const METHOD_LABELS: Record<string, string> = {
  self_qr: "QR",
  lvh_scan: "LVH scan",
  manual: "Manual",
  auto: "Auto",
  substitute: "Substitute",
};

type ManualTarget = { member: BoardMember; mode: "present" | "late" | "remove" };

async function fetchFeed(meetingId: string): Promise<Feed | null> {
  try {
    const res = await fetch(`/api/lvh/${meetingId}/feed`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Feed) : null;
  } catch {
    return null;
  }
}

export function LvhBoard({
  meetingId,
  canManual,
  canFinalize,
}: {
  meetingId: string;
  canManual: boolean;
  canFinalize: boolean;
}) {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [stale, setStale] = useState(false);
  const [manual, setManual] = useState<ManualTarget | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchFeed(meetingId);
    if (data) setFeed(data);
    setStale(!data);
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const data = await fetchFeed(meetingId);
      if (cancelled) return;
      if (data) setFeed(data);
      setStale(!data);
      timer = setTimeout(poll, 3000);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [meetingId]);

  if (!feed) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-center text-muted-foreground">Loading board…</div>;
  }

  const finalized = feed.meeting.status !== "scheduled";
  const notYet = feed.members.filter((m) => !m.status);
  const inRoom = feed.members.filter((m) => m.status === "P" || m.status === "L");
  const others = feed.members.filter((m) => m.status && m.status !== "P" && m.status !== "L");
  const subs = feed.members.filter((m) => m.substitute || m.leave);
  const late = inRoom.filter((m) => m.status === "L").length;
  const flagged = inRoom.filter((m) => m.flags.length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/lvh" className="text-sm text-muted-foreground hover:text-foreground">
            ← LVH desk
          </Link>
          <h1 className="text-2xl font-bold">{feed.meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            Starts {formatTime(new Date(feed.meeting.startsAt))} · Late after that
            {finalized ? " · finalized" : ""}
            {stale ? " · reconnecting…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManual && !finalized ? (
            <Button variant="outline" onClick={() => setScanOpen(true)}>
              <QrCodeIcon /> Scan member pass
            </Button>
          ) : null}
          {canFinalize && !finalized ? (
            <Button onClick={() => setFinalizeOpen(true)}>Finalize</Button>
          ) : null}
          {finalized ? (
            <Button asChild>
              <Link href={`/meetings/${meetingId}/summary`}>PALMS summary</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Checked in" value={inRoom.length} sub={`${late} late`} />
        <Stat label="Not yet" value={notYet.length} />
        <Stat label="Substitutes" value={feed.members.filter((m) => m.status === "S").length} />
        <Stat label="Expected" value={feed.members.length} />
        <VisitorCounter key={feed.visitors} meetingId={meetingId} value={feed.visitors} editable={canManual || canFinalize} />
      </div>

      {flagged.length ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangleIcon className="size-4" /> Check these in person
          </div>
          {flagged.map((m) => (
            <div key={m.id}>
              {m.name}: {m.flags.map((f) => FLAG_LABELS[f] ?? f).join(", ")}
            </div>
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="notyet">
        <TabsList className="mb-3 w-full justify-start overflow-x-auto">
          <TabsTrigger value="notyet">Not yet ({notYet.length})</TabsTrigger>
          <TabsTrigger value="in">In ({inRoom.length + others.length})</TabsTrigger>
          <TabsTrigger value="subs">Subs & leave ({subs.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({feed.rejected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="notyet">
          <List>
            {notYet.map((m) => (
              <Row key={m.id} m={m}>
                {m.leave ? (
                  <Badge variant="secondary">{m.leave.kind === "medical" ? `Medical (${m.leave.status})` : "Informed"}</Badge>
                ) : null}
                {m.substitute ? <Badge variant="secondary">Sub: {m.substitute.name}</Badge> : null}
                {m.phone ? (
                  <Button asChild variant="ghost" size="icon-sm">
                    <a href={`tel:${m.phone}`} aria-label={`Call ${m.name}`}>
                      <PhoneIcon />
                    </a>
                  </Button>
                ) : null}
                {canManual && !finalized ? (
                  <Button size="sm" variant="outline" onClick={() => setManual({ member: m, mode: "present" })}>
                    Mark in
                  </Button>
                ) : null}
              </Row>
            ))}
            {notYet.length === 0 ? <Empty text="Everyone expected is accounted for." /> : null}
          </List>
        </TabsContent>

        <TabsContent value="in">
          <List>
            {[...inRoom, ...others]
              .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
              .map((m) => (
                <Row key={m.id} m={m}>
                  {m.status ? <StatusBadge status={m.status} /> : null}
                  <span className="text-xs text-muted-foreground">
                    {m.at ? formatTime(new Date(m.at)) : ""} · {m.method ? METHOD_LABELS[m.method] : ""}
                  </span>
                  {m.flags.length ? <AlertTriangleIcon className="size-4 text-amber-600" /> : null}
                  {canManual && !finalized && m.status === "P" ? (
                    <Button size="sm" variant="ghost" onClick={() => setManual({ member: m, mode: "late" })}>
                      Mark late
                    </Button>
                  ) : null}
                  {canManual && !finalized && m.status !== "M" ? (
                    <Button size="sm" variant="ghost" onClick={() => setManual({ member: m, mode: "remove" })}>
                      Undo
                    </Button>
                  ) : null}
                </Row>
              ))}
          </List>
        </TabsContent>

        <TabsContent value="subs">
          <List>
            {subs.map((m) => (
              <Row key={m.id} m={m}>
                {m.substitute ? (
                  <span className="text-sm">
                    Sub: <b>{m.substitute.name}</b> · {m.substitute.phone}
                  </span>
                ) : null}
                {m.leave ? (
                  <Badge variant="secondary">
                    {m.leave.kind === "medical" ? `Medical · ${m.leave.status}` : "Informed absence"}
                  </Badge>
                ) : null}
                {m.substitute && !m.substitute.arrived && canManual && !finalized ? (
                  <ConfirmSubButton meetingId={meetingId} memberId={m.id} onDone={load} />
                ) : m.substitute?.arrived ? (
                  <Badge>
                    <CheckIcon /> Arrived
                  </Badge>
                ) : null}
              </Row>
            ))}
            {subs.length === 0 ? <Empty text="No substitutes or leave for this meeting." /> : null}
          </List>
        </TabsContent>

        <TabsContent value="rejected">
          <List>
            {feed.rejected.map((r, i) => (
              <div key={`${r.at}-${i}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="w-16 text-xs text-muted-foreground tabular-nums">{formatTime(new Date(r.at))}</span>
                <span className="font-medium">{r.name ?? "Unknown"}</span>
                <span className="text-muted-foreground">
                  {REJECTION_MESSAGES[r.reason]?.split(".")[0] ?? r.reason}
                  {r.via === "lvh_scan" ? " · pass scan" : ""}
                </span>
              </div>
            ))}
            {feed.rejected.length === 0 ? <Empty text="No rejected attempts." /> : null}
          </List>
        </TabsContent>
      </Tabs>

      <ManualDialog meetingId={meetingId} target={manual} onClose={() => setManual(null)} onDone={load} />
      <PassScanDialog open={scanOpen} onOpenChange={setScanOpen} meetingId={meetingId} onDone={load} />
      <FinalizeDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        feed={feed}
        onDone={() => router.push(`/meetings/${meetingId}/summary`)}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">
        {label}
        {sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="divide-y rounded-xl border bg-card">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function Row({ m, children }: { m: BoardMember; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <MemberAvatar name={m.name} src={m.photoUrl} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{m.name}</div>
        <div className="truncate text-xs text-muted-foreground">{m.business ?? m.category}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ConfirmSubButton({ meetingId, memberId, onDone }: { meetingId: string; memberId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await lvhConfirmSubstitute({ meetingId, memberId });
          if (res.ok) {
            toast.success("Substitute confirmed (S).");
            onDone();
          } else toast.error(res.error);
        })
      }
    >
      <UserCheckIcon /> Arrived
    </Button>
  );
}

function ManualDialog({
  meetingId,
  target,
  onClose,
  onDone,
}: {
  meetingId: string;
  target: ManualTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"P" | "L">("P");
  const [pending, start] = useTransition();
  if (!target) return null;
  const title =
    target.mode === "remove"
      ? `Undo ${target.member.name}'s check-in?`
      : target.mode === "late"
        ? `Mark ${target.member.name} late?`
        : `Mark ${target.member.name} in by hand?`;

  function submit() {
    start(async () => {
      const res =
        target!.mode === "remove"
          ? await lvhRemoveCheckin({ meetingId, memberId: target!.member.id, reason })
          : await lvhManualCheckin({
              meetingId,
              memberId: target!.member.id,
              status: target!.mode === "late" ? "L" : status,
              reason,
            });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved. This is recorded in the audit log.");
      setReason("");
      onClose();
      onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Manual changes are shown with a &quot;Manual&quot; badge in the PALMS summary and logged with your name and
            reason. Use the member&apos;s check-in pass first if their phone works.
          </DialogDescription>
        </DialogHeader>
        {target.mode === "present" ? (
          <div className="flex gap-2">
            <Button variant={status === "P" ? "default" : "outline"} onClick={() => setStatus("P")}>
              Present (P)
            </Button>
            <Button variant={status === "L" ? "default" : "outline"} onClick={() => setStatus("L")}>
              Late (L)
            </Button>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              target.mode === "remove" ? "e.g. checked in by mistake" : target.mode === "late" ? "e.g. left early" : "e.g. phone battery dead"
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || reason.trim().length < 3} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PassScanDialog({
  open,
  onOpenChange,
  meetingId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meetingId: string;
  onDone: () => void;
}) {
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string>("");

  async function handle(pass: string) {
    setBusy(true);
    const res = await scanMemberPass({ meetingId, pass });
    if (res.ok) {
      const msg = `${res.memberName}: ${res.already ? "already in" : res.status === "L" ? "checked in (Late)" : "checked in"}`;
      toast.success(msg);
      setLast(msg);
      onDone();
    } else {
      const msg = `${res.memberName ? `${res.memberName}: ` : ""}${REJECTION_MESSAGES[res.reason] ?? res.reason}`;
      toast.error(msg);
      setLast(msg);
    }
    setBusy(false);
    setRound((r) => r + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan a member&apos;s check-in pass</DialogTitle>
          <DialogDescription>Ask the member to open Check in → My check-in pass.</DialogDescription>
        </DialogHeader>
        {open ? (
          busy ? (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted">
              <RefreshCwIcon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <QrScanner key={round} accept={(v) => v.startsWith("BNIDP1.")} onScan={handle} />
          )
        ) : null}
        {last ? <p className="text-sm">{last}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({
  open,
  onOpenChange,
  feed,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  feed: Feed;
  onDone: () => void;
}) {
  const [headcount, setHeadcount] = useState("");
  const [pending, start] = useTransition();
  const checkedIn = feed.members.filter((m) => m.status === "P" || m.status === "L").length;
  const notYet = feed.members.filter((m) => !m.status);
  const pendingMedical = feed.members.filter((m) => m.leave?.kind === "medical" && m.leave.status === "pending");
  const subsNotConfirmed = feed.members.filter((m) => m.substitute && !m.substitute.arrived);
  const count = headcount === "" ? null : Number(headcount);
  const mismatch = count !== null && count !== checkedIn;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize this meeting?</DialogTitle>
          <DialogDescription>
            Everyone not checked in becomes Absent (A), or Medical (M) if their medical leave is approved. The meeting
            then locks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="headcount">Members physically in the room (headcount)</Label>
            <Input
              id="headcount"
              inputMode="numeric"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-muted-foreground">Checked in on the app: {checkedIn}</p>
            {mismatch ? (
              <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                Headcount and check-ins don&apos;t match. Look at flagged check-ins and the &quot;In&quot; list before
                finalizing.
              </p>
            ) : null}
          </div>
          <p>{notYet.length} member(s) will be marked absent or medical.</p>
          {pendingMedical.length ? (
            <p className="rounded-md bg-amber-50 p-2 text-amber-900">
              {pendingMedical.length} medical leave request(s) are still pending and will count as absent:{" "}
              {pendingMedical.map((m) => m.name).join(", ")}.
            </p>
          ) : null}
          {subsNotConfirmed.length ? (
            <p className="rounded-md bg-amber-50 p-2 text-amber-900">
              Substitutes not confirmed (will be absent): {subsNotConfirmed.map((m) => m.name).join(", ")}.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || headcount === ""}
            onClick={() =>
              start(async () => {
                const res = await lvhFinalize({ meetingId: feed.meeting.id, headcount: count });
                if (!res.ok) return void toast.error(res.error);
                toast.success("Meeting finalized.");
                onOpenChange(false);
                onDone();
              })
            }
          >
            Finalize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
