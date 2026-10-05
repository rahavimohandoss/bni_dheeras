"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteForm, saveForm } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FormField, FormFieldType } from "@/db/schema";
import { CHOICE_TYPES, FIELD_TYPE_LABELS } from "@/lib/forms";

type Values = {
  title: string;
  description: string;
  kind: "custom" | "visitor_registration" | "visitor_feedback" | "event_registration" | "survey";
  visibility: "public" | "members";
  opensOn: string;
  closesOn: string;
  maxResponses: string;
  onePerMember: boolean;
  isActive: boolean;
  fields: FormField[];
};

const newId = () => `q_${Math.random().toString(36).slice(2, 8)}`;

export function FormBuilder({ id, initial }: { id: string; initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((s) => ({ ...s, [k]: value }));
  const setField = (i: number, patch: Partial<FormField>) =>
    set(
      "fields",
      v.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    );
  const moveField = (i: number, to: number) => {
    if (to < 0 || to >= v.fields.length) return;
    const copy = [...v.fields];
    const [item] = copy.splice(i, 1);
    copy.splice(to, 0, item);
    set("fields", copy);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Who can fill it</Label>
            <Select value={v.visibility} onValueChange={(x) => set("visibility", x as Values["visibility"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Anyone with the link (visitors)</SelectItem>
                <SelectItem value="members">Signed-in members only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Counts as</Label>
            <Select value={v.kind} onValueChange={(x) => set("kind", x as Values["kind"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">General form</SelectItem>
                <SelectItem value="visitor_registration">Visitor registration (counts in PALMS)</SelectItem>
                <SelectItem value="visitor_feedback">Visitor feedback</SelectItem>
                <SelectItem value="event_registration">Event registration</SelectItem>
                <SelectItem value="survey">Survey</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opens">Opens on (optional)</Label>
            <Input id="opens" type="date" value={v.opensOn} onChange={(e) => set("opensOn", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closes">Closes after (optional)</Label>
            <Input id="closes" type="date" value={v.closesOn} onChange={(e) => set("closesOn", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max">Response limit (e.g. event seats)</Label>
            <Input
              id="max"
              inputMode="numeric"
              placeholder="No limit"
              value={v.maxResponses}
              onChange={(e) => set("maxResponses", e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={v.onePerMember}
                disabled={v.visibility === "public"}
                onCheckedChange={(x) => set("onePerMember", !!x)}
              />
              One response per member
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={v.isActive} onCheckedChange={(x) => set("isActive", x)} /> Accepting responses
            </label>
          </div>
        </CardContent>
      </Card>

      {v.fields.map((f, i) => (
        <Card key={f.id}>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input value={f.label} placeholder="Question" onChange={(e) => setField(i, { label: e.target.value })} />
              <Select value={f.type} onValueChange={(x) => setField(i, { type: x as FormFieldType })}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={f.help ?? ""}
              placeholder="Help text (optional)"
              onChange={(e) => setField(i, { help: e.target.value || undefined })}
            />
            {CHOICE_TYPES.includes(f.type) ? (
              <Textarea
                placeholder="Options, one per line"
                value={(f.options ?? []).join("\n")}
                onChange={(e) => setField(i, { options: e.target.value.split("\n").map((o) => o.trimStart()) })}
                onBlur={() => setField(i, { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) })}
              />
            ) : null}
            <div className="flex items-center gap-1">
              <label className="mr-auto flex items-center gap-2 text-sm">
                <Checkbox checked={f.required} onCheckedChange={(x) => setField(i, { required: !!x })} /> Required
              </label>
              <Button variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => moveField(i, i - 1)}>
                <ArrowUpIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" onClick={() => moveField(i, i + 1)}>
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete question"
                onClick={() => set("fields", v.fields.filter((_, j) => j !== i))}
              >
                <Trash2Icon />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => set("fields", [...v.fields, { id: newId(), type: "short_text", label: "", required: false }])}
        >
          <PlusIcon /> Add question
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveForm(id, {
                ...v,
                fields: v.fields.map((f) => ({ ...f, options: f.options?.map((o) => o.trim()).filter(Boolean) })),
              });
              if (res.ok) toast.success("Form saved.");
              else toast.error(res.error);
            })
          }
        >
          Save form
        </Button>
        <Button
          variant="ghost"
          className="ml-auto text-destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this form and all its responses?")) return;
            start(async () => {
              const res = await deleteForm(id);
              if (!res.ok) return void toast.error(res.error);
              router.push("/admin/forms");
            });
          }}
        >
          Delete form
        </Button>
      </div>
    </div>
  );
}
