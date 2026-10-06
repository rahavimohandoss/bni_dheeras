import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentMember } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sterling-light px-4 py-10">
      <div className="mb-6 text-center">
        <BrandLogo height={112} preload className="mx-auto mb-3" />
        <h1 className="sr-only">BNI Dheeras</h1>
        <p className="text-sm text-muted-foreground">Chapter app · Madurai</p>
      </div>
      <LoginForm />
    </main>
  );
}
