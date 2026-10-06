import { Badge } from "@/components/ui/badge";
import type { FeedbackStatus } from "@/db/schema";

const LABELS: Record<FeedbackStatus, string> = { new: "New", in_progress: "In progress", done: "Done" };

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge variant={status === "done" ? "secondary" : status === "in_progress" ? "default" : "outline"}>{LABELS[status]}</Badge>;
}

export const FEEDBACK_STATUS_LABELS = LABELS;
