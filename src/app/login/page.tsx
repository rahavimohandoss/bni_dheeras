import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  INVALID_TOKEN: "That login link was already used or has expired. Ask the Secretary for a new one.",
  FORBIDDEN: "This account is not active. Please contact the Secretary.",
  user_not_found: "This account isn't registered. Please contact the Secretary.",
  new_user_signup_disabled: "This account isn't registered. Please contact the Secretary.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentMember()) redirect("/");
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? "That login link didn't work. Ask the Secretary for a new one.") : null;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sterling-light px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground">
          BNI
        </div>
        <h1 className="text-2xl font-bold">BNI Dheeras</h1>
        <p className="text-sm text-muted-foreground">Chapter app · Madurai</p>
      </div>
      <LoginForm error={message} />
    </main>
  );
}
