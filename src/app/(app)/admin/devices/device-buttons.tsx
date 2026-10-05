"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveDevice, revokeDevice } from "@/actions/device";
import {
  AlertDialog,
  AlertDialogAction,
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

export function ApproveDeviceButton({ id, name, code }: { id: string; name: string; code: string }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending}>Approve</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve {name}&apos;s phone?</AlertDialogTitle>
          <AlertDialogDescription>
            Check that {name} is holding the phone and its screen shows code <b>{code}</b>. Their previous phone will stop
            working for check-in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const res = await approveDevice(id);
                if (res.ok) toast.success(`${name}'s phone approved.`);
                else toast.error(res.error);
              })
            }
          >
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RevokeDeviceButton({ id, name }: { id: string; name: string }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}&apos;s phone?</AlertDialogTitle>
          <AlertDialogDescription>It will stop working for check-in immediately. The member is notified.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Reason (e.g. lost phone)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const res = await revokeDevice(id, reason);
                if (res.ok) toast.success("Phone removed.");
                else toast.error(res.error);
              })
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
