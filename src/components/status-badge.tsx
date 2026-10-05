import type { AttendanceStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/attendance/rules";
import { cn } from "@/lib/utils";

const STYLES: Record<AttendanceStatus, string> = {
  P: "bg-green-100 text-green-800 border-green-200",
  L: "bg-amber-100 text-amber-900 border-amber-200",
  A: "bg-red-100 text-red-800 border-red-200",
  M: "bg-sky-100 text-sky-800 border-sky-200",
  S: "bg-violet-100 text-violet-800 border-violet-200",
};

export function StatusBadge({
  status,
  full,
  className,
}: {
  status: AttendanceStatus;
  full?: boolean;
  className?: string;
}) {
  return (
    <span
      title={STATUS_LABELS[status]}
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold",
        STYLES[status],
        className,
      )}
    >
      {full ? `${status} · ${STATUS_LABELS[status]}` : status}
    </span>
  );
}
