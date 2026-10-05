import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/db";
import { member } from "@/db/schema";
import { RecoveryForm, SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } };

export default async function SetupPage() {
  await connection();
  const admins = await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true)).limit(1);
  const done = admins.length > 0;
  const tokenSet = !!process.env.SETUP_TOKEN;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      {!done ? (
        <>
          <h1 className="text-2xl font-bold">First-time setup</h1>
          {tokenSet ? (
            <>
              <p className="mt-2 mb-6 text-sm text-muted-foreground">
                Create the first admin. You&apos;ll sign in straight away, then add the chapter&apos;s members and send
                them login links on WhatsApp.
              </p>
              <SetupForm />
            </>
          ) : (
            <p className="mt-3 text-muted-foreground">
              Set <code>SETUP_TOKEN</code> in the environment to create the first admin.
            </p>
          )}
        </>
      ) : tokenSet ? (
        <>
          <h1 className="text-2xl font-bold">Admin recovery</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Setup is complete. If an admin can&apos;t sign in, enter the setup token and their email to get a one-time
            sign-in link. Remove <code>SETUP_TOKEN</code> from the environment when you&apos;re done.
          </p>
          <RecoveryForm />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Setup complete</h1>
          <p className="mt-3 text-muted-foreground">
            <Link className="text-primary underline" href="/login">
              Go to sign in
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
