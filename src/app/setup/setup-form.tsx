"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSetup } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState(completeSetup, null);
  if (state?.ok) {
    return (
      <Alert>
        <AlertDescription>
          Admin created.{" "}
          <Link href="/login" className="font-medium text-primary underline">
            Sign in now
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="token">Setup token</Label>
        <Input id="token" name="token" type="password" required autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile (optional)</Label>
        <Input id="phone" name="phone" inputMode="tel" />
      </div>
      <SubmitButton className="w-full">Create admin</SubmitButton>
    </form>
  );
}
