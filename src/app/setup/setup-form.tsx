"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSetup, recoverAdmin } from "./actions";

function SignInNow({ url, text }: { url: string; text: string }) {
  return (
    <div className="space-y-3">
      <Alert>
        <AlertDescription>{text}</AlertDescription>
      </Alert>
      <Button asChild className="h-11 w-full text-base">
        {/* Same-tab navigation keeps the one-time token out of other apps. */}
        <a href={url}>Sign in now</a>
      </Button>
      <p className="text-xs text-muted-foreground">The link works once and expires in 24 hours.</p>
    </div>
  );
}

export function SetupForm() {
  const [state, action] = useActionState(completeSetup, null);
  if (state?.ok) return <SignInNow url={state.data.loginUrl} text="Admin created. Sign in on the phone you'll use for the app." />;
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
        <Label htmlFor="phone">WhatsApp mobile number</Label>
        <Input id="phone" name="phone" inputMode="tel" />
      </div>
      <SubmitButton className="w-full">Create admin</SubmitButton>
    </form>
  );
}

export function RecoveryForm() {
  const [state, action] = useActionState(recoverAdmin, null);
  if (state?.ok) return <SignInNow url={state.data.loginUrl} text="Sign-in link created for this admin." />;
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
        <Label htmlFor="r-email">Admin email</Label>
        <Input id="r-email" name="email" type="email" required />
      </div>
      <SubmitButton className="w-full" variant="outline">
        Get an admin sign-in link
      </SubmitButton>
    </form>
  );
}
