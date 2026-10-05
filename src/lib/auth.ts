import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appUrl, trustedOrigins } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";

const DAY = 60 * 60 * 24;

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
    emailOTP({
      // Accounts are created only from the admin roster (no self sign-up).
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        const task = sendEmail({
          to: email,
          subject: `${otp} is your BNI Dheeras login code`,
          text: `Your BNI Dheeras login code is ${otp}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
        });
        // Don't make the request wait on the email (avoids timing leaks).
        try {
          after(task);
        } catch {
          void task;
        }
      },
    }),
    nextCookies(),
  ],
});
