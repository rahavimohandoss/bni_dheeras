"use client";

import { CheckCheckIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await markAllNotificationsRead();
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      <CheckCheckIcon /> Mark all read
    </Button>
  );
}
