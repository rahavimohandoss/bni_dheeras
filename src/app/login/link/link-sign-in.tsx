"use client";

import { Loader2Icon, LogInIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const noop = () => () => {};
const readToken = () => window.location.hash.slice(1);

/**
 * Redeems the one-time token only when the member taps the button, so link
 * previews (WhatsApp, browsers) can't use it up. The token never reaches our
 * server logs as part of a page URL: it travels in the fragment.
 */
export function LinkSignIn() {
  // null until the page is running in the browser (the fragment isn't sent to the server).
  const token = useSyncExternalStore<string | null>(noop, readToken, () => null);
  const [busy, setBusy] = useState(false);

  if (token === null) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Opening your login link…
        </CardContent>
      </Card>
    );
  }

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Link incomplete</CardTitle>
          <CardDescription>
            Open the full link from your WhatsApp message, or ask the Secretary for a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to BNI Dheeras</CardTitle>
        <CardDescription>
          This link works once. Use it on the phone you&apos;ll check in with; you&apos;ll stay signed in on this phone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="h-12 w-full text-base" aria-disabled={busy}>
          {/* A real link: redeeming sets the session cookie, so it must be a full navigation. */}
          <a
            href={`/api/auth/magic-link/verify?${new URLSearchParams({ token, callbackURL: "/", errorCallbackURL: "/login" })}`}
            onClick={(e) => {
              if (busy) return e.preventDefault();
              setBusy(true);
              // Clear the token from the address bar and history before redeeming it.
              history.replaceState(null, "", "/login/link");
            }}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
            Sign in
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
