import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@/lib/app-url";
import { auth } from "@/lib/auth";
import { LOGIN_LINK_TTL_SECONDS, withTokenCapture } from "@/lib/login-link-capture";

/**
 * One-time login link for a member, to send on WhatsApp. The token sits in the
 * URL fragment (#…): browsers never send fragments to servers, so WhatsApp's
 * link preview can't use up the link. The member taps "Sign in" on /login/link,
 * which redeems it once.
 */
export async function createLoginLink(email: string): Promise<{ url: string; expiresAt: Date }> {
  const requestHeaders = await headers();
  const token = await withTokenCapture(() =>
    auth.api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: requestHeaders }),
  );
  if (!token) throw new Error("Could not create a login link.");
  const base = appUrl() || process.env.BETTER_AUTH_URL || "";
  return {
    url: `${base}/login/link#${token}`,
    expiresAt: new Date(Date.now() + LOGIN_LINK_TTL_SECONDS * 1000),
  };
}

export function whatsappMessage(firstName: string, url: string): string {
  return `Vanakkam ${firstName}! Here is your BNI Dheeras app login link (one-time, valid 24 hours):\n${url}\n\nOpen it on the phone you'll use for check-in.`;
}
