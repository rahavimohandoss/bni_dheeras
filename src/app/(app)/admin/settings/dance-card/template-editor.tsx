"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDanceCardTemplate } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DanceCardTemplate } from "@/lib/dance-card";

const newKey = (label: string) =>
  `${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "field"}_${Math.random().toString(36).slice(2, 6)}`;

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function TemplateEditor({ initial }: { initial: DanceCardTemplate }) {
  const [t, setT] = useState(initial);
  const [pending, start] = useTransition();

  const setSection = (i: number, patch: Partial<DanceCardTemplate["sections"][number]>) =>
    setT((cur) => ({ sections: cur.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  return (
    <div className="space-y-4">
      {t.sections.map((section, si) => (
        <Card key={si}>
          <CardContent className="space-y-3 py-4">
            <div className="flex gap-2">
              <Input
                className="font-semibold"
                value={section.title}
                onChange={(e) => setSection(si, { title: e.target.value })}
                placeholder="Section title"
              />
              <Button variant="ghost" size="icon" aria-label="Move section up" onClick={() => setT((c) => ({ sections: move(c.sections, si, si - 1) }))}>
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete section"
                onClick={() => setT((c) => ({ sections: c.sections.filter((_, j) => j !== si) }))}
              >
                <Trash2Icon />
              </Button>
            </div>
            {section.fields.map((f, fi) => (
              <div key={f.key} className="flex flex-wrap gap-2 pl-2 sm:flex-nowrap">
                <Input
                  value={f.label}
                  onChange={(e) =>
                    setSection(si, { fields: section.fields.map((x, j) => (j === fi ? { ...x, label: e.target.value } : x)) })
                  }
                  placeholder="Question"
                />
                <Select
                  value={f.type}
                  onValueChange={(v) =>
                    setSection(si, { fields: section.fields.map((x, j) => (j === fi ? { ...x, type: v as "short" | "long" } : x)) })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">One line</SelectItem>
                    <SelectItem value="long">Paragraph</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => setSection(si, { fields: move(section.fields, fi, fi - 1) })}>
                  <ArrowUpIcon />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => setSection(si, { fields: move(section.fields, fi, fi + 1) })}>
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete question"
                  onClick={() => setSection(si, { fields: section.fields.filter((_, j) => j !== fi) })}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSection(si, { fields: [...section.fields, { key: newKey("question"), label: "", type: "long" }] })}
            >
              <PlusIcon /> Add question
            </Button>
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setT((c) => ({
              sections: [...c.sections, { title: "New section", fields: [{ key: newKey("question"), label: "", type: "long" }] }],
            }))
          }
        >
          <PlusIcon /> Add section
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const cleaned = {
                sections: t.sections
                  .map((s) => ({ ...s, fields: s.fields.filter((f) => f.label.trim()) }))
                  .filter((s) => s.title.trim() && s.fields.length),
              };
              const res = await saveDanceCardTemplate(cleaned);
              if (res.ok) toast.success("Template saved.");
              else toast.error(res.error);
            })
          }
        >
          Save template
        </Button>
      </div>
    </div>
  );
}
