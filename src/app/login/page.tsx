import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sterling-light px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground">
          BNI
        </div>
        <h1 className="text-2xl font-bold">BNI Dheeras</h1>
        <p className="text-sm text-muted-foreground">Chapter app · Madurai</p>
      </div>
      <LoginForm />
    </main>
  );
}
