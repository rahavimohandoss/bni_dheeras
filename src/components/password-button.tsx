"use client";

import { CopyIcon, KeyRoundIcon, MessageCircleIcon, RotateCcwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getLoginDetails, type LoginDetails, resetMemberPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Head Table: a member's login details while they're on the default password
 * (to send on WhatsApp), or a reset back to the default if they forgot theirs.
 */
export function PasswordButton({ memberId, name, variant = "ghost" }: { memberId: string; name: string; variant?: "ghost" | "outline" }) {
  const [details, setDetails] = useState<LoginDetails | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      const res = await getLoginDetails(memberId);
      if (res.ok) setDetails(res.data);
      else toast.error(res.error);
    });
  const reset = () =>
    start(async () => {
      const res = await resetMemberPassword(memberId);
      setConfirming(false);
      if (!res.ok) return void toast.error(res.error);
      setDetails(res.data);
      toast.success(`${name}'s password is back to the default.`);
    });
  const message = details?.defaultPassword
    ? `Login ID: ${details.loginId}\nPassword: ${details.defaultPassword}`
    : "";

  return (
    <>
      <Button variant={variant} size="sm" disabled={pending} onClick={open}>
        <KeyRoundIcon /> Password
      </Button>
      <Dialog
        open={!!details}
        onOpenChange={(o) => {
          if (!o) {
            setDetails(null);
            setConfirming(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{name}: sign-in</DialogTitle>
            <DialogDescription>
              {details?.defaultPassword
                ? "Still on the default password. They choose their own the first time they sign in."
                : "They've set their own password. If they forgot it, reset it to the default and they'll choose a new one when they sign in."}
            </DialogDescription>
          </DialogHeader>
          {details?.defaultPassword ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <dt className="text-muted-foreground">Login ID</dt>
              <dd className="font-medium break-all">{details.loginId}</dd>
              <dt className="text-muted-foreground">Password</dt>
              <dd className="font-mono font-medium">{details.defaultPassword}</dd>
            </dl>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {details?.defaultPassword ? (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message).catch(() => {});
                    toast.success("Copied.");
                  }}
                >
                  <CopyIcon /> Copy
                </Button>
                {details.whatsappUrl ? (
                  <Button asChild>
                    <a href={details.whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircleIcon /> Send on WhatsApp
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">No mobile number saved.</span>
                )}
              </>
            ) : confirming ? (
              <>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={reset} disabled={pending}>
                  Yes, reset to default
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <RotateCcwIcon /> Reset to default password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
