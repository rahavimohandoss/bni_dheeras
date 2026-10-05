import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, trustedOrigins } from "@/lib/app-url";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/format";

const DAY = 60 * 60 * 24;

/*
 * Members sign in with their mobile number (or email) and a password. New
 * members start on the chapter's default password and choose their own at the
 * first sign-in; the Head Table resets forgotten passwords back to the
 * default. There is no self sign-up: accounts exist only if an admin added them.
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
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  // Members stay signed in until they sign out: every visit pushes the expiry
  // out again. Browsers keep a cookie for at most 400 days, so that's the
  // longest anyone can go without opening the app.
  session: { expiresIn: 400 * DAY, updateAge: DAY },
  rateLimit: { enabled: true, storage: "database" },
  // Sign-in and password changes go through our server actions (throttling,
  // default-password rules, audit log), never straight to these endpoints.
  disabledPaths: [
    "/sign-in/email",
    "/sign-up/email",
    "/change-password",
    "/verify-password",
    "/request-password-reset",
    "/reset-password",
    "/update-user",
    "/change-email",
    "/delete-user",
  ],
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
  plugins: [nextCookies()],
});
