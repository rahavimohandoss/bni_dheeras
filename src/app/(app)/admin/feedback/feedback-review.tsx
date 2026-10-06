"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFeedback, reviewFeedback } from "@/actions/feedback";
import { ConfirmButton } from "@/components/confirm-button";
import { FEEDBACK_STATUS_LABELS } from "@/components/feedback-status";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackStatus } from "@/db/schema";

/** Status, reply and delete for one submission. */
export function FeedbackReview({ id, status, response }: { id: string; status: FeedbackStatus; response: string | null }) {
  const router = useRouter();
  const [s, setS] = useState<FeedbackStatus>(status);
  const [reply, setReply] = useState(response ?? "");
  const [pending, start] = useTransition();
  const dirty = s !== status || reply.trim() !== (response ?? "");

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        maxLength={2000}
        placeholder="Reply to the member (optional; they get a notification)"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={s} onValueChange={(v) => setS(v as FeedbackStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((k) => (
              <SelectItem key={k} value={k}>
                {FEEDBACK_STATUS_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const res = await reviewFeedback({ id, status: s, response: reply });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Saved.");
              router.refresh();
            })
          }
        >
          Save
        </Button>
        <div className="ml-auto">
          <ConfirmButton
            label="Delete"
            title="Delete this submission?"
            description="It's removed for good, for you and the member."
            success="Deleted."
            action={() => deleteFeedback(id)}
          />
        </div>
      </div>
    </div>
  );
}
