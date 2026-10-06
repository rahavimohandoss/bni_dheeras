"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { lvhReopen } from "@/actions/lvh";
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

/** Reopens a finalized meeting so a wrong P/A/L/M/S can be corrected on the LVH board. */
export function ReopenMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Reopen for corrections</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reopen this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            Correct the statuses on the LVH board, then finalize again. Every change is recorded in the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Reason (e.g. Ravi was marked absent by mistake)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const res = await lvhReopen({ meetingId, reason });
                if (!res.ok) return void toast.error(res.error);
                setOpen(false);
                toast.success("Reopened. Make the corrections, then finalize again.");
                router.push(`/lvh/${meetingId}`);
              })
            }
          >
            Reopen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
