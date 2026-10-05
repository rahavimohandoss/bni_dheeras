"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDanceCard } from "@/actions/dance-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DanceCardTemplate } from "@/lib/dance-card";

export function DanceCardForm({ template, initial }: { template: DanceCardTemplate; initial: Record<string, string> }) {
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

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {template.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {section.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.type === "long" ? (
                  <Textarea
                    id={f.key}
                    rows={3}
                    value={data[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => {
                      setData((d) => ({ ...d, [f.key]: e.target.value }));
                      setDirty(true);
                    }}
                  />
                ) : (
                  <Input
                    id={f.key}
                    value={data[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => {
                      setData((d) => ({ ...d, [f.key]: e.target.value }));
                      setDirty(true);
                    }}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" disabled={pending || !dirty} className="shadow-lg">
          {dirty ? "Save dance card" : "Saved"}
        </Button>
      </div>
    </form>
  );
}
