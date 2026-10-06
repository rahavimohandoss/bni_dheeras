"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buildPass, PASS_ROTATE_MS, signedPayload } from "@/lib/attendance/payloads";
import { signWithDevice } from "@/lib/device-key";

/**
 * Fallback for when scanning the venue QR fails (e.g. a broken camera): a QR signed by
 * this phone's device key, refreshed every 30 seconds, for an LVH member to scan.
 */
export function MemberPass({ memberId, deviceId }: { memberId: string; deviceId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(PASS_ROTATE_MS / 1000);

  useEffect(() => {
    let cancelled = false;
    let issuedAt = 0;
    async function issue() {
      try {
        const ts = Date.now();
        const signature = await signWithDevice(signedPayload.pass(memberId, deviceId, ts));
        const url = await QRCode.toDataURL(buildPass(memberId, deviceId, ts, signature), {
          margin: 1,
          width: 360,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          issuedAt = ts;
          setSrc(url);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    issue();
    const rotate = setInterval(issue, PASS_ROTATE_MS);
    const tick = setInterval(() => {
      if (issuedAt) setSecondsLeft(Math.max(0, Math.ceil((issuedAt + PASS_ROTATE_MS - Date.now()) / 1000)));
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [memberId, deviceId]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Only if scanning the venue QR fails: show this to an LVH team member. It refreshes every 30 seconds and works
          only on your approved phone.
        </p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Check-in pass QR" className="size-72 rounded-lg border" />
        ) : (
          <div className="size-72 animate-pulse rounded-lg bg-muted" />
        )}
        <p className="text-xs text-muted-foreground">Refreshes in {secondsLeft}s</p>
      </CardContent>
    </Card>
  );
}
