"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDanceCard } from "@/actions/dance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type CardField, DANCE_CARD, maxAnswerLength } from "@/lib/dance-card";

/** The chapter's dance card, in the same order and wording as the printed card. */
export function DanceCardForm({ initial }: { initial: Record<string, string> }) {
  const [data, setData] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveDanceCard(data);
      if (!res.ok) return void toast.error(res.error);
      setDirty(false);
      toast.success("Dance card saved.");
    });
  const set = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {DANCE_CARD.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg font-bold tracking-wide text-primary uppercase">{section.title}</CardTitle>
            {section.note ? <CardDescription className="italic">({section.note})</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {section.groups.map((group, i) => (
              <div key={group.title ?? i} className="space-y-3">
                {group.title ? <h3 className="font-bold">{group.title}:</h3> : null}
                {group.fields.map((f) => (
                  <FieldInput key={f.key} field={f} value={data[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button type="submit" size="lg" disabled={pending || !dirty} className="shadow-lg">
          {dirty ? "Save dance card" : "Saved"}
        </Button>
      </div>
    </form>
  );
}

function FieldInput({ field, value, onChange }: { field: CardField; value: string; onChange: (value: string) => void }) {
  const max = maxAnswerLength(field);
  const props = {
    id: field.key,
    value,
    maxLength: max,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  const counter = value.length > max * 0.8 ? `${value.length}/${max}` : null;
  const note = UNPRINTABLE.test(value) ? "Tamil letters and emoji don't print on the PDF card; please use English." : null;

  if (field.kind === "numbered") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Label htmlFor={field.key} className="w-7 shrink-0 justify-end">
            {field.label}
          </Label>
          <Input {...props} />
        </div>
        {note ? <p className="pl-10 text-xs text-amber-700">{note}</p> : null}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key} className={field.kind === "prompt" ? "font-normal text-muted-foreground" : "font-bold"}>
        {field.kind === "prompt" ? `– ${field.label}` : `${field.label}:`}
      </Label>
      {/* Two lines on the printed card: room for a longer answer. */}
      {field.lines.length > 1 ? <Textarea rows={2} {...props} /> : <Input {...props} />}
      {field.hint || counter ? (
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{field.hint ? `– ${field.hint}` : null}</span>
          {counter ? <span className="shrink-0 tabular-nums">{counter}</span> : null}
        </div>
      ) : null}
      {note ? <p className="text-xs text-amber-700">{note}</p> : null}
    </div>
  );
}

/** Outside what the card's font (Helvetica, WinAnsi) can print; ₹ prints as "Rs.". */
const UNPRINTABLE = /[^\x20-\x7e -ÿ–—‘-„•…€™₹]/;
