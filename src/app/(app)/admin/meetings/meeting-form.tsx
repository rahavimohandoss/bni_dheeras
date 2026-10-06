"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMeeting, generateWeekly, updateMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type VenueOption = { id: string; name: string };

export type MeetingFormValues = {
  title: string;
  kind: "weekly" | "visitor_day" | "event" | "training" | "other";
  mode: "in_person" | "online";
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  opensBeforeMin: string;
  weeks: string;
};

const KIND_LABELS = {
  weekly: "Weekly meeting",
  visitor_day: "Visitor day",
  event: "Event",
  training: "Training",
  other: "Other",
};

export function MeetingForm({
  mode: formMode,
  venues,
  initial,
  meetingId,
}: {
  mode: "single" | "weekly" | "edit";
  venues: VenueOption[];
  initial: MeetingFormValues;
  meetingId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof MeetingFormValues>(k: K, value: MeetingFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const common = {
        title: v.title,
        date: v.date,
        startTime: v.startTime,
        endTime: v.endTime,
        opensBeforeMin: v.opensBeforeMin,
        venueId: v.venueId,
      };
      if (formMode === "weekly") {
        const res = await generateWeekly({ ...common, weeks: v.weeks });
        if (!res.ok) return void toast.error(res.error);
        toast.success(
          res.data.skipped
            ? `${res.data.count} created; ${res.data.skipped} week(s) already had a meeting and were skipped.`
            : `${res.data.count} weekly meetings created.`,
        );
        router.refresh();
        return;
      }
      const payload = { ...common, kind: v.kind, mode: v.mode };
      const res = formMode === "edit" ? await updateMeeting(meetingId!, payload) : await createMeeting(payload);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved.");
      router.push("/admin/meetings");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} required />
        </Field>
        {formMode !== "weekly" ? (
          <Field label="Type">
            <Select value={v.kind} onValueChange={(x) => set("kind", x as MeetingFormValues["kind"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {formMode !== "weekly" ? (
          <Field label="Where">
            <Select value={v.mode} onValueChange={(x) => set("mode", x as MeetingFormValues["mode"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {v.mode === "in_person" || formMode === "weekly" ? (
          <Field label="Venue">
            <Select value={v.venueId} onValueChange={(x) => set("venueId", x)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label={formMode === "weekly" ? "First meeting date" : "Date"}>
          <Input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} required />
          </Field>
          <Field label="Ends">
            <Input type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} required />
          </Field>
        </div>
        {formMode === "weekly" ? (
          <Field label="Number of weeks">
            <Input inputMode="numeric" value={v.weeks} onChange={(e) => set("weeks", e.target.value.replace(/\D/g, ""))} />
          </Field>
        ) : null}
        <Field label="Check-in opens (minutes before start)">
          <Input
            inputMode="numeric"
            value={v.opensBeforeMin}
            onChange={(e) => set("opensBeforeMin", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {formMode === "weekly" ? "Create weekly meetings" : formMode === "edit" ? "Save changes" : "Create meeting"}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
