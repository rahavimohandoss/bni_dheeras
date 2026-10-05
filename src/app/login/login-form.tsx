"use client";

import { Loader2Icon, MessageCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { requestLoginLink } from "@/actions/login";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ error }: { error: string | null }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Members sign in with a one-time login link that the Secretary sends on WhatsApp. Open it on the phone you use
          for check-in; you&apos;ll stay signed in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {sent ? (
          <Alert>
            <MessageCircleIcon />
            <AlertDescription>
              Request sent. If this number is registered, the Secretary will send your login link on WhatsApp.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setProblem(null);
              start(async () => {
                const res = await requestLoginLink(phone);
                if (res.ok) setSent(true);
                else setProblem(res.error);
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="phone">Don&apos;t have a link? Your registered mobile number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98400 12345"
                className="h-11 text-base"
              />
            </div>
            {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
            <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <MessageCircleIcon />}
              Request a login link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
