"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAttendanceSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttendanceSettings } from "@/lib/settings";

type Key = keyof AttendanceSettings;

const FIELDS: { key: Key; label: string; hint: string; optional?: boolean }[] = [
  {
    key: "defaultGraceMinutes",
    label: "Default grace minutes for new meetings",
    hint: "Empty = late from the exact start time. Each meeting can override it.",
    optional: true,
  },
  { key: "defaultGeofenceM", label: "Default geofence for new venues (m)", hint: "Members must be within this distance of the venue pin." },
  {
    key: "gpsAccuracyAllowanceM",
    label: "GPS accuracy allowance (m)",
    hint: "Indoor GPS drifts. Up to this many metres of the phone's reported inaccuracy is forgiven. Set 0 for strict.",
  },
  { key: "maxGpsAccuracyM", label: "Reject GPS worse than (m)", hint: "Very rough fixes (Precise Location off) are refused." },
  { key: "checkinOpensBeforeMin", label: "Check-in opens (minutes before start)", hint: "Default for new meetings." },
  { key: "absenceLimit", label: "Absence limit", hint: "BNI policy: 3 absences in 6 months." },
  { key: "absenceWindowMonths", label: "Absence window (months)", hint: "Rolling window for the absence counter." },
  { key: "lateFlagCount", label: "Lateness flag: number of lates", hint: "Coaching flag to the Attendance Coordinator." },
  { key: "lateFlagWeeks", label: "Lateness flag: within weeks", hint: "" },
];

export function AttendanceSettingsForm({ initial }: { initial: AttendanceSettings }) {
  const [values, setValues] = useState<Record<Key, string>>(
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v === null ? "" : String(v)])) as Record<Key, string>,
  );
  const [pending, start] = useTransition();

  function save() {
    const payload = Object.fromEntries(
      FIELDS.map((f) => [f.key, values[f.key] === "" && f.optional ? null : Number(values[f.key])]),
    );
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
              placeholder={f.optional ? "Empty = none" : undefined}
              value={values[f.key]}
              onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value.replace(/\D/g, "") }))}
            />
            {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
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
