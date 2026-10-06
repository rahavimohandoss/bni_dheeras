"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMeeting } from "@/actions/meetings";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Deletes a meeting with everything recorded for it, after saying exactly what
 * goes. Attendance is PALMS history, so deleting it also needs a reason.
 */
export function DeleteMeetingButton({
  meetingId,
  when,
  records,
  recognitions,
  finalized,
  redirectTo,
  size = "default",
  variant = "ghost",
}: {
  meetingId: string;
  /** e.g. "Tue, 6 Oct, 2026" */
  when: string;
  /** Attendance rows (P/A/L/M/S) recorded for the meeting. */
  records: number;
  recognitions: number;
  finalized: boolean;
  redirectTo?: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const history = records > 0 || finalized;
  const goes = [records ? plural(records, "attendance record") : null, recognitions ? plural(recognitions, "recognition") : null].filter(
    Boolean,
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size}>
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete the meeting on {when}?</AlertDialogTitle>
          <AlertDialogDescription>
            {goes.length ? (
              <>
                This also deletes {goes.join(" and ")}.
                {history ? " The meeting disappears from PALMS, absence counts and reports." : ""} It can&apos;t be undone; the
                audit log keeps a copy.
              </>
            ) : (
              "Nothing was recorded for it, so it's simply removed from the schedule."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {history ? (
          <Input placeholder="Reason (e.g. test meeting)" value={reason} onChange={(e) => setReason(e.target.value)} />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending || (history && reason.trim().length < 3)}
            onClick={() =>
              start(async () => {
                const res = await deleteMeeting(meetingId, reason);
                if (!res.ok) return void toast.error(res.error);
                setOpen(false);
                toast.success("Meeting deleted.");
                if (redirectTo) router.push(redirectTo);
                router.refresh();
              })
            }
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
