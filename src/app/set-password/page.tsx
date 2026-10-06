import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentMember } from "@/lib/session";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };

/** First sign-in with the default password: choose your own before using the app. */
export default async function SetPasswordPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/login");
  if (!me.mustChangePassword) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sterling-light px-4 py-10">
      <BrandLogo height={80} preload className="mb-6" />
      <SetPasswordForm name={me.fullName} />
    </main>
  );
}
