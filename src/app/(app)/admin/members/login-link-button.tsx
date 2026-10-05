"use client";

import { CopyIcon, KeyRoundIcon, MessageCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMemberLoginLink, type LoginLink } from "@/actions/login";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/time";

/** Creates a one-time login link for a member and offers to send it on WhatsApp. */
export function LoginLinkButton({ memberId, name }: { memberId: string; name: string }) {
  const [link, setLink] = useState<LoginLink | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createMemberLoginLink(memberId);
            if (res.ok) setLink(res.data);
            else toast.error(res.error);
          })
        }
      >
        <KeyRoundIcon /> Login link
      </Button>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login link for {name}</DialogTitle>
            <DialogDescription>
              One-time link, valid until {link ? formatDateTime(new Date(link.expiresAt)) : ""}. Send it only to {name}:
              whoever opens it is signed in as them. Don&apos;t open it yourself.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={link?.url ?? ""} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={async () => {
                if (!link) return;
                await navigator.clipboard.writeText(link.url).catch(() => {});
                toast.success("Link copied.");
              }}
            >
              <CopyIcon /> Copy link
            </Button>
            {link?.whatsappUrl ? (
              <Button asChild>
                <a href={link.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon /> Send on WhatsApp
                </a>
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">No mobile number saved — copy the link instead.</span>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
