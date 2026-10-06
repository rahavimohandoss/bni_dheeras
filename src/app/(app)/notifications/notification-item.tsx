"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteNotification, markNotificationRead } from "@/actions/notifications";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; link: string | null; read: boolean; when: string };

/** One notification: opening it marks it read; × removes it. */
export function NotificationItem({ n }: { n: Item }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = () =>
    start(async () => {
      if (!n.read) await markNotificationRead(n.id);
      if (n.link) router.push(n.link);
      else router.refresh();
    });
  return (
    <div className={cn("flex items-start gap-2 px-4 py-3", !n.read && "bg-primary/5", pending && "opacity-60")}>
      <button type="button" onClick={open} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</div>
          <div className="shrink-0 text-xs text-muted-foreground">{n.when}</div>
        </div>
        {n.body ? <div className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{n.body}</div> : null}
      </button>
      <button
        type="button"
        aria-label="Delete notification"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() =>
          start(async () => {
            const res = await deleteNotification(n.id);
            if (!res.ok) toast.error(res.error);
          })
        }
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
