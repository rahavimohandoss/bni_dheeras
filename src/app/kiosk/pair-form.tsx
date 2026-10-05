"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { pairKiosk } from "@/actions/kiosk";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

export function PairForm() {
  const router = useRouter();
  const [state, action] = useActionState(pairKiosk, null);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Input
        name="code"
        inputMode="numeric"
        maxLength={6}
        placeholder="6-digit code"
        className="h-14 text-center font-mono text-3xl tracking-[0.4em]"
        required
      />
      <SubmitButton className="h-12 w-full text-base">Pair this screen</SubmitButton>
    </form>
  );
}
