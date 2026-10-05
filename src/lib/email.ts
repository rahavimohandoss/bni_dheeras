import "server-only";
import { Resend } from "resend";

type Email = { to: string | string[]; subject: string; text: string };

let resend: Resend | null = null;

/**
 * Sends a plain-text email through Resend. Without RESEND_API_KEY the email is
 * printed to the server console in development (so OTP login works locally)
 * and dropped with an error in production.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email:dev] to: ${[to].flat().join(", ")}\nsubject: ${subject}\n${text}\n`);
    } else {
      console.error("[email] RESEND_API_KEY is not set; email not sent:", subject);
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
