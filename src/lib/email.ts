import "server-only";
import { Resend } from "resend";

type Email = { to: string | string[]; subject: string; text: string };

let resend: Resend | null = null;
let warned = false;

/**
 * Optional email copies of notifications (absence alerts, Monday report).
 * Sign-in does not use email: members use their mobile number and password. Without
 * RESEND_API_KEY, emails are skipped; the in-app notification still appears.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email:dev] to: ${[to].flat().join(", ")}\nsubject: ${subject}\n${text}\n`);
    } else if (!warned) {
      warned = true;
      console.info("[email] RESEND_API_KEY not set: email copies are off (in-app notifications only).");
    }
    return;
  }
  resend ??= new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "BNI Dheeras <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
  if (error) console.error("[email] send failed:", error);
}
