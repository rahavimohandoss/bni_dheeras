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
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  success?: string;
  action: () => Promise<Result>;
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{destructive ? "Keep it" : "Cancel"}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await action();
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
