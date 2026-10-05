"use client";

import { CheckCircle2Icon, StarIcon } from "lucide-react";
import Script from "next/script";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitForm } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/db/schema";
import { cn } from "@/lib/utils";

type Answers = Record<string, string | string[]>;

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string };
  }
}

export function FormFill({
  slug,
  fields,
  turnstileSiteKey,
}: {
  slug: string;
  fields: FormField[];
  turnstileSiteKey: string | null;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const widget = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (turnstileSiteKey && scriptReady && widget.current && window.turnstile && !widget.current.hasChildNodes()) {
      window.turnstile.render(widget.current, { sitekey: turnstileSiteKey, callback: setToken });
    }
  }, [turnstileSiteKey, scriptReady]);

  const set = (id: string, value: string | string[]) => setAnswers((a) => ({ ...a, [id]: value }));

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2Icon className="size-12 text-green-600" />
        <p className="text-lg font-semibold">Thank you! Your response was recorded.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitForm(slug, answers, token);
          if (res.ok) setDone(true);
          else toast.error(res.error);
        });
      }}
    >
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={f.id}>
            {f.label}
            {f.required ? <span className="text-primary"> *</span> : null}
          </Label>
          {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
          <FieldInput field={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} />
        </div>
      ))}
      {turnstileSiteKey ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={() => setScriptReady(true)}
          />
          <div ref={widget} />
        </>
      ) : null}
      <Button type="submit" className="h-11 w-full text-base" disabled={pending || (!!turnstileSiteKey && !token)}>
        Submit
      </Button>
    </form>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
}: {
  field: FormField;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const str = typeof value === "string" ? value : "";
  switch (f.type) {
    case "long_text":
      return <Textarea id={f.id} rows={4} value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input id={f.id} inputMode="decimal" value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input id={f.id} type="email" value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input id={f.id} type="tel" inputMode="tel" value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input id={f.id} type="date" value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
    case "rating":
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={f.label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => onChange(String(n))}
              className="p-1"
            >
              <StarIcon className={cn("size-8", Number(str) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
      );
    case "yes_no":
      return (
        <RadioGroup value={str} onValueChange={onChange} className="flex gap-4">
          {["yes", "no"].map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm capitalize">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case "single_choice":
      return (
        <RadioGroup value={str} onValueChange={onChange} className="gap-2">
          {f.options?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case "dropdown":
      return (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger id={f.id} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {f.options?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_choice": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {f.options?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={list.includes(o)}
                onCheckedChange={(c) => onChange(c ? [...list, o] : list.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    default:
      return <Input id={f.id} value={str} required={f.required} onChange={(e) => onChange(e.target.value)} />;
  }
}
