"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAttendanceSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditableAttendanceSettings } from "@/lib/settings";

type Key = keyof EditableAttendanceSettings;

const FIELDS: { key: Key; label: string; hint: string }[] = [
  { key: "checkinOpensBeforeMin", label: "Check-in opens (minutes before start)", hint: "Default for new meetings." },
  { key: "absenceLimit", label: "Absence limit", hint: "BNI policy: 3 absences in 6 months." },
  { key: "absenceWindowMonths", label: "Absence window (months)", hint: "Rolling window for the absence counter." },
  {
    key: "lateFlagCount",
    label: "Lateness flag: number of lates",
    hint: "Coaching flag to the Attendance Coordinator when a member is late this many times in {weeks} weeks.",
  },
];

export function AttendanceSettingsForm({ initial, lateFlagWeeks }: { initial: EditableAttendanceSettings; lateFlagWeeks: number }) {
  const [values, setValues] = useState<Record<Key, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(initial[f.key])])) as Record<Key, string>,
  );
  const [pending, start] = useTransition();

  function save() {
    const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])]));
    start(async () => {
      const res = await saveAttendanceSettings(payload);
      if (res.ok) toast.success("Settings saved.");
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value.replace(/\D/g, "") }))}
            />
            {f.hint ? <p className="text-xs text-muted-foreground">{f.hint.replace("{weeks}", String(lateFlagWeeks))}</p> : null}
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button onClick={save} disabled={pending}>
            Save rules
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
