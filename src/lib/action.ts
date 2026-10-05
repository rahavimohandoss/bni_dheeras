import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AttendanceError } from "@/lib/attendance/service";
import { AuthError } from "@/lib/session";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

/**
 * Wraps a server action body: known errors become `{ ok: false, error }`
 * with a readable message; anything unexpected is logged and hidden.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserError || error instanceof AuthError || error instanceof AttendanceError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const field = issue?.path.join(".");
      return { ok: false, error: issue ? `${field ? `${field}: ` : ""}${issue.message}` : "Invalid input." };
    }
    console.error("[action] unexpected error", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
