"use client";

import { useActionState } from "react";
import { setOwnPassword } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SignOutButton } from "@/components/user-menu";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/format";

export function SetPasswordForm({ name }: { name: string }) {
  const [state, action] = useActionState(setOwnPassword, null);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set your password</CardTitle>
        <CardDescription>
          Welcome, {name.split(" ")[0]}! You signed in with the default password. Choose your own now; you&apos;ll stay
          signed in on this phone until you sign out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Type it again</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
              className="h-11 text-base"
            />
          </div>
          <SubmitButton className="h-11 w-full text-base">Save and continue</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Not {name}? <SignOutButton className="inline-flex items-center gap-1 text-primary underline [&_svg]:hidden" />
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
