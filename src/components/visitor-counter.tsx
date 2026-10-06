"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setVisitorCount } from "@/actions/lvh";
import { Button } from "@/components/ui/button";

/**
 * Visitors at a meeting, counted at the door with − / +. Render it with
 * `key={value}` so a newer count from the server replaces the local one.
 */
export function VisitorCounter({ meetingId, value, editable }: { meetingId: string; value: number; editable: boolean }) {
  const [count, setCount] = useState(value);
  const [, start] = useTransition();
  const change = (next: number) => {
    if (next < 0) return;
    setCount(next);
    start(async () => {
      const res = await setVisitorCount({ meetingId, count: next });
      if (!res.ok) toast.error(res.error);
    });
  };
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-1">
        <div className="text-2xl font-bold tabular-nums">{count}</div>
        {editable ? (
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="size-7" onClick={() => change(count - 1)} aria-label="One visitor less">
              <MinusIcon />
            </Button>
            <Button size="icon" variant="outline" className="size-7" onClick={() => change(count + 1)} aria-label="One more visitor">
              <PlusIcon />
            </Button>
          </div>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground">Visitors</div>
    </div>
  );
}
