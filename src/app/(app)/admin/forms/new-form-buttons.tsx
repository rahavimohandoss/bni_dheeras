"use client";

import { FilePlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createForm } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import type { FormTemplateKey } from "@/lib/forms";

const OPTIONS: { key: FormTemplateKey | "blank"; label: string }[] = [
  { key: "visitor_registration", label: "Visitor registration" },
  { key: "visitor_feedback", label: "Visitor feedback" },
  { key: "event_registration", label: "Event registration" },
  { key: "survey", label: "Survey" },
  { key: "blank", label: "Blank form" },
];

export function NewFormButtons() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <Button
          key={o.key}
          variant={o.key === "blank" ? "outline" : "secondary"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createForm(o.key);
              if (!res.ok) return void toast.error(res.error);
              router.push(`/admin/forms/${res.data.id}`);
            })
          }
        >
          <FilePlusIcon /> {o.label}
        </Button>
      ))}
    </div>
  );
}
