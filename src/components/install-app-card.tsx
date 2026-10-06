"use client";

import { DownloadIcon, ShareIcon } from "lucide-react";
import Image from "next/image";
import { useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInstallState, getServerInstallState, promptInstall, subscribeInstall } from "@/lib/install-app";

/**
 * Home: "Get the app" in a phone browser, or on a computer whose browser can
 * install it in one tap (Chrome, Edge). Hidden inside the installed app.
 */
export function InstallAppCard() {
  const state = useSyncExternalStore(subscribeInstall, getInstallState, getServerInstallState);
  const [pending, start] = useTransition();
  if (state === "installed" || state === "hidden") return null;

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Image
          src="/icons/app-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl ring-1 ring-foreground/10"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Get the BNI Dheeras app</div>
          <p className="text-sm text-muted-foreground">
            {state === "ios" ? (
              <>
                Tap <ShareIcon className="inline size-4 align-text-bottom" aria-label="Share" /> Share, then{" "}
                <b>Add to Home Screen</b>. On iPhone, check-in works from the installed app.
              </>
            ) : state === "manual" ? (
              <>
                Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.
              </>
            ) : (
              "Opens straight from your home screen, like any other app."
            )}
          </p>
        </div>
        {state === "prompt" ? (
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await promptInstall()) toast.success("Installed. Open BNI Dheeras from your home screen.");
              })
            }
          >
            <DownloadIcon /> Install
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
