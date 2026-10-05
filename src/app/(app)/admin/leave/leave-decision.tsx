"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { decideLeave } from "@/actions/leave";
import { Button } from "@/components/ui/button";

export function LeaveDecision({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decideLeave(id, approve);
      if (res.ok) toast.success(approve ? "Approved." : "Rejected.");
      else toast.error(res.error);
    });
  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending} onClick={() => decide(false)}>
        Reject
      </Button>
      <Button disabled={pending} onClick={() => decide(true)}>
        Approve
      </Button>
    </div>
  );
}
