"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { decideLeave } from "@/actions/leave";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";

export function LeaveDecision({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <ConfirmButton
        label="Reject"
        title={`Reject ${name}'s medical leave?`}
        description="If they don't attend, it counts as an absence. They're notified."
        success="Rejected."
        action={() => decideLeave(id, false)}
        variant="outline"
        size="default"
      />
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await decideLeave(id, true);
            if (res.ok) toast.success("Approved.");
            else toast.error(res.error);
          })
        }
      >
        Approve
      </Button>
    </div>
  );
}

/** Flip an earlier decision while the meeting is still open. */
export function ChangeLeaveDecision({ id, name, approved }: { id: string; name: string; approved: boolean }) {
  return (
    <ConfirmButton
      label={approved ? "Change to rejected" : "Change to approved"}
      title={approved ? `Reject ${name}'s medical leave after all?` : `Approve ${name}'s medical leave after all?`}
      description="They're notified of the new decision."
      success="Decision changed."
      action={() => decideLeave(id, !approved)}
      destructive={approved}
    />
  );
}
