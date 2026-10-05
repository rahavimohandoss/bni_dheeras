"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/format";
import { completeSetup, recoverAdmin } from "./actions";

function PasswordFields() {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
        <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Type it again</Label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
      </div>
    </>
  );
}

export function SetupForm() {
  const [state, action] = useActionState(completeSetup, null);
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
        <Label htmlFor="phone">Mobile number (login ID)</Label>
        <Input id="phone" name="phone" inputMode="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <PasswordFields />
      <SubmitButton className="w-full">Create admin and sign in</SubmitButton>
    </form>
  );
}

export function RecoveryForm() {
  const [state, action] = useActionState(recoverAdmin, null);
  if (state?.ok) {
    return (
      <div className="space-y-3">
        <Alert>
          <AlertDescription>Password updated. Sign in with it now.</AlertDescription>
        </Alert>
        <Button asChild className="h-11 w-full text-base">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
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
        <Label htmlFor="r-token">Setup token</Label>
        <Input id="r-token" name="token" type="password" required autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-login">Admin or President mobile number or email</Label>
        <Input id="r-login" name="loginId" autoCapitalize="none" spellCheck={false} required />
      </div>
      <PasswordFields />
      <SubmitButton className="w-full" variant="outline">
        Set new password
      </SubmitButton>
    </form>
  );
}
