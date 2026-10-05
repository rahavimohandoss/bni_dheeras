"use client";

import { CalendarPlusIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function SubscribeButton({ path }: { path: string }) {
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  const webcal = url.replace(/^https?:/, "webcal:");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlusIcon /> Add to my phone calendar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to the chapter calendar</DialogTitle>
          <DialogDescription>
            Meetings and events appear in your phone&apos;s calendar and update automatically. This link is private to you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Button asChild className="w-full">
            <a href={webcal}>iPhone / Mac: Subscribe</a>
          </Button>
          <div>
            <p className="mb-1 font-medium">Google Calendar</p>
            <p className="mb-2 text-muted-foreground">Settings → Add calendar → From URL, then paste:</p>
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={async () => {
                  await navigator.clipboard.writeText(url).catch(() => {});
                  toast.success("Link copied.");
                }}
              >
                <CopyIcon />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
