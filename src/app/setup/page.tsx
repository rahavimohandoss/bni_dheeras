import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/db";
import { member } from "@/db/schema";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "First-time setup" };

export default async function SetupPage() {
  await connection();
  const admins = await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true)).limit(1);
  const done = admins.length > 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">First-time setup</h1>
      {done ? (
        <p className="mt-3 text-muted-foreground">
          Setup is complete.{" "}
          <Link className="text-primary underline" href="/login">
            Sign in
          </Link>
          .
        </p>
      ) : !process.env.SETUP_TOKEN ? (
        <p className="mt-3 text-muted-foreground">
          Set <code>SETUP_TOKEN</code> in the environment to create the first admin.
        </p>
      ) : (
        <>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">
            Create the first admin account. You&apos;ll then sign in with a code sent to this email and add the rest of
            the chapter.
          </p>
          <SetupForm />
        </>
      )}
    </main>
  );
}
