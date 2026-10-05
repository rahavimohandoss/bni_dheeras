"use client";

import { Loader2Icon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: clean, type: "sign-in" });
    setBusy(false);
    if (error) {
      toast.error(error.status === 429 ? "Too many requests. Wait a minute and try again." : error.message ?? "Couldn't send the code.");
      return;
    }
    setEmail(clean);
    setStep("code");
    toast.success("If this email is registered, a 6-digit code is on its way.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (error) {
      setBusy(false);
      toast.error(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : error.message ?? "That code didn't work.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{step === "email" ? "Sign in" : "Enter your code"}</CardTitle>
        <CardDescription>
          {step === "email" ? (
            "We'll email you a 6-digit code. No password needed."
          ) : (
            <>
              Sent to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                className="h-11 text-base"
              />
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
              {busy ? <Loader2Icon className="animate-spin" /> : <MailIcon />}
              Email me a code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
              />
            </div>
            <Button type="submit" className="h-11 w-full text-base" disabled={busy || code.length !== 6}>
              {busy ? <Loader2Icon className="animate-spin" /> : null}
              Sign in
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted-foreground underline" onClick={() => setStep("email")}>
                Change email
              </button>
              <button
                type="button"
                className="text-muted-foreground underline"
                disabled={busy}
                onClick={() => sendCode()}
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
