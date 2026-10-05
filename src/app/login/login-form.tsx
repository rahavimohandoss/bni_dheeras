"use client";

import { LogInIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { signIn } from "@/actions/auth";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  // Controlled, so a wrong password doesn't clear the login ID.
  const [loginId, setLoginId] = useState("");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="loginId">Mobile number or email</Label>
            <Input
              id="loginId"
              name="loginId"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="98400 12345"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required className="h-11 text-base" />
          </div>
          <SubmitButton className="h-11 w-full text-base">
            <LogInIcon /> Sign in
          </SubmitButton>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              <b className="font-medium text-foreground">First time?</b> Use the default password from your Head Table.
              You&apos;ll choose your own right after.
            </p>
            <p>
              <b className="font-medium text-foreground">Forgot your password?</b> Ask the President, VP or Secretary to
              reset it.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
