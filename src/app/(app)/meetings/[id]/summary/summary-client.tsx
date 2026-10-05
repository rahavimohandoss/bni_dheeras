"use client";

import { ClipboardCopyIcon, PhoneIcon, PrinterIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveFollowup } from "@/actions/lvh";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/** Tab-separated rows paste cleanly into a spreadsheet or alongside BNI Connect's PALMS screen. */
export function CopyPalmsButton({ rows }: { rows: { name: string; status: string; substitute: string }[] }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const text = ["Member\tPALMS\tSubstitute", ...rows.map((r) => `${r.name}\t${r.status}\t${r.substitute}`)].join("\n");
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied. Paste it next to BNI Connect's PALMS entry.");
        } catch {
          toast.error("Couldn't copy. Use the CSV download instead.");
        }
      }}
    >
      <ClipboardCopyIcon /> Copy for BNI Connect
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <PrinterIcon /> Print
    </Button>
  );
}

export function FollowupRow({
  meetingId,
  memberId,
  name,
  phone,
  called,
  note,
}: {
  meetingId: string;
  memberId: string;
  name: string;
  phone: string | null;
  called: boolean;
  note: string;
}) {
  const [isCalled, setCalled] = useState(called);
  const [text, setText] = useState(note);
  const [pending, start] = useTransition();
  const save = (nextCalled: boolean, nextNote: string) =>
    start(async () => {
      const res = await saveFollowup({ meetingId, memberId, called: nextCalled, note: nextNote });
      if (!res.ok) toast.error(res.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Checkbox
        checked={isCalled}
        disabled={pending}
        onCheckedChange={(v) => {
          setCalled(!!v);
          save(!!v, text);
        }}
        aria-label={`Called ${name}`}
      />
      <span className="min-w-32 font-medium">{name}</span>
      {phone ? (
        <a href={`tel:${phone}`} className="flex items-center gap-1 text-sm text-primary">
          <PhoneIcon className="size-3.5" /> {phone}
        </a>
      ) : null}
      <Input
        className="min-w-48 flex-1"
        placeholder="Note (e.g. travelling, will send sub next week)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== note && save(isCalled, text)}
      />
    </div>
  );
}
