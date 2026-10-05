import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/db";
import { form } from "@/db/schema";
import { getCurrentMember } from "@/lib/session";
import { FormFill } from "./form-fill";

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [f] = await db.select({ title: form.title }).from(form).where(eq(form.slug, slug));
  return { title: f?.title ?? "Form" };
}

export default async function FormPage({ params }: PageProps<"/f/[slug]">) {
  await connection();
  const { slug } = await params;
  const [f] = await db.select().from(form).where(eq(form.slug, slug));
  if (!f) notFound();
  const me = await getCurrentMember();
  const now = new Date();
  const closed = !f.isActive || (f.opensAt && now < f.opensAt) || (f.closesAt && now > f.closesAt);

  return (
    <main className="min-h-dvh bg-sterling-light px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">
            BNI
          </span>
          <span className="font-bold">BNI Dheeras</span>
        </div>
        <div className="rounded-2xl border bg-background p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{f.title}</h1>
          {f.description ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{f.description}</p> : null}
          <div className="mt-5">
            {closed ? (
              <p className="rounded-lg bg-muted p-4 text-sm">This form isn&apos;t accepting responses right now.</p>
            ) : f.visibility === "members" && !me ? (
              <p className="rounded-lg bg-muted p-4 text-sm">
                This form is for BNI Dheeras members.{" "}
                <Link className="text-primary underline" href="/login">
                  Sign in
                </Link>{" "}
                to fill it.
              </p>
            ) : (
              <FormFill
                slug={f.slug}
                fields={f.fields}
                turnstileSiteKey={f.visibility === "public" && !me ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
