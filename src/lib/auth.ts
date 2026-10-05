import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, trustedOrigins } from "@/lib/app-url";
import { captureLoginToken, LOGIN_LINK_TTL_SECONDS } from "@/lib/login-link-capture";

const DAY = 60 * 60 * 24;

/*
 * Members sign in with one-time login links that the Secretary/Admin creates
 * and sends on WhatsApp (no email service). Links are single-use, valid for
 * 24 hours and stored hashed. Accounts exist only if an admin added them.
 */
export const auth = betterAuth({
  appName: "BNI Dheeras",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || appUrl() || undefined,
  trustedOrigins: trustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: { enabled: false },
  // Long sessions: members stay signed in on their registered phone.
  session: { expiresIn: 90 * DAY, updateAge: DAY },
  rateLimit: { enabled: true, storage: "database" },
  // Links are created only by admins on the server, never requested over HTTP.
  disabledPaths: ["/sign-in/magic-link"],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [m] = await db
            .select({ status: schema.member.status })
            .from(schema.member)
            .where(eq(schema.member.id, session.userId));
          if (!m || m.status !== "active") {
            throw new APIError("FORBIDDEN", { message: "This account is not active." });
          }
        },
      },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      expiresIn: LOGIN_LINK_TTL_SECONDS,
      storeToken: "hashed",
      // Nothing is emailed: the token is handed back to the admin who asked for it.
      sendMagicLink: ({ token }) => captureLoginToken(token),
    }),
    nextCookies(),
  ],
});
