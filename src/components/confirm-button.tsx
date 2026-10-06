"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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

type Result = { ok: true } | { ok: false; error: string };

/**
 * A button that asks "are you sure?" before running a server action, then
 * shows the outcome as a toast. For deletes, deactivations and removals.
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  success,
  action,
  variant = "ghost",
  size = "sm",
  destructive = true,
  redirectTo,
  icon,
  className,
  ariaLabel,
  requireReason,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  success?: string;
  /** Gets the typed reason when `requireReason` is set. */
  action: (reason?: string) => Promise<Result>;
  /** Asks for a reason first (this is the field's placeholder); confirm stays off until one is typed. */
  requireReason?: string;
  variant?: "ghost" | "outline" | "destructive" | "default";
  size?: "sm" | "default";
  destructive?: boolean;
  redirectTo?: string;
  icon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={pending} className={className} aria-label={ariaLabel}>
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {requireReason ? <Input placeholder={requireReason} value={reason} onChange={(e) => setReason(e.target.value)} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{destructive ? "Keep it" : "Cancel"}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || (!!requireReason && reason.trim().length < 3)}
            onClick={() =>
              start(async () => {
                const res = await (requireReason ? action(reason) : action());
                if (!res.ok) return void toast.error(res.error);
                setOpen(false);
                if (success) toast.success(success);
                if (redirectTo) router.push(redirectTo);
                router.refresh();
              })
            }
          >
            {confirmLabel ?? label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
