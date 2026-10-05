import type { Metadata } from "next";
import { LinkSignIn } from "./link-sign-in";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** Landing page for WhatsApp login links. The token is in the URL fragment and only redeemed on tap. */
export default function LoginLinkPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-sterling-light px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground">
          BNI
        </div>
        <h1 className="text-2xl font-bold">BNI Dheeras</h1>
      </div>
      <LinkSignIn />
    </main>
  );
}
