"use client";

import { CheckCircle2Icon, Loader2Icon, MapPinIcon, ScanLineIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkIn } from "@/actions/checkin";
import { DeviceCard, type DeviceSummary, useLocalDevice } from "@/components/device-card";
import { MemberPass } from "@/components/member-pass";
import { QrScanner } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { signedPayload } from "@/lib/attendance/payloads";
import { REJECTION_MESSAGES } from "@/lib/attendance/rules";
import type { CheckinResult } from "@/lib/attendance/service";
import { deviceThumbprint, getDeviceKey, signWithDevice } from "@/lib/device-key";
import { type Fix, GeoError, getBestPosition } from "@/lib/geolocation";
import { formatDistance } from "@/lib/attendance/geo";
import { formatTime } from "@/lib/time";

type Phase = "idle" | "scanning" | "locating" | "submitting" | "done";

export function ScanClient({
  memberId,
  devices,
  devVenue,
  isDev,
}: {
  memberId: string;
  devices: DeviceSummary[];
  devVenue: { lat: number; lng: number } | null;
  isDev: boolean;
}) {
  const router = useRouter();
  const [local] = useLocalDevice(devices);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [problem, setProblem] = useState("");
  const [devToken, setDevToken] = useState("");
  const [devAtVenue, setDevAtVenue] = useState(true);

  async function submit(qrToken: string) {
    setProblem("");
    setPhase("locating");
    let geo: Fix | null = null;
    try {
      geo =
        isDev && devAtVenue && devVenue
          ? { lat: devVenue.lat, lng: devVenue.lng, accuracy: 15 }
          : await getBestPosition();
    } catch (e) {
      // Let the server decide: online meetings don't need location.
      if (e instanceof GeoError && e.code === "denied") setProblem(e.message);
    }
    setPhase("submitting");
    try {
      const key = await getDeviceKey();
      if (!key) throw new Error("This phone isn't registered.");
      const thumbprint = await deviceThumbprint(key.publicJwk);
      const signature = await signWithDevice(signedPayload.checkin(memberId, qrToken));
      const res = await checkIn({ qrToken, thumbprint, signature, geo });
      setResult(res);
    } catch (e) {
      setResult({ ok: false, reason: "bad_signature" });
      setProblem((e as Error).message);
    }
    setPhase("done");
    router.refresh();
  }

  if (local.kind !== "approved") {
    return (
      <div className="space-y-4">
        <DeviceCard memberId={memberId} devices={devices} />
        <p className="text-sm text-muted-foreground">
          Check-in works only from your approved phone. Once it&apos;s approved, come back here and scan the QR on the
          venue screen.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="scan">
      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value="scan">Scan venue QR</TabsTrigger>
        <TabsTrigger value="pass">My check-in pass</TabsTrigger>
      </TabsList>

      <TabsContent value="scan" className="space-y-4">
        {phase === "idle" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <ScanLineIcon className="size-14 text-primary" />
              <div>
                <p className="font-semibold">Point your camera at the QR on the venue screen</p>
                <p className="text-sm text-muted-foreground">
                  The QR changes every 15 seconds. Your location is checked once, when you scan.
                </p>
              </div>
              <Button size="lg" className="h-12 w-full max-w-xs text-base" onClick={() => setPhase("scanning")}>
                Start scanning
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {phase === "scanning" ? (
          <div className="space-y-3">
            <QrScanner accept={(v) => v.startsWith("BNID1.")} onScan={submit} />
            <Button variant="outline" className="w-full" onClick={() => setPhase("idle")}>
              Cancel
            </Button>
          </div>
        ) : null}

        {phase === "locating" || phase === "submitting" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              {phase === "locating" ? (
                <MapPinIcon className="size-10 animate-pulse text-primary" />
              ) : (
                <Loader2Icon className="size-10 animate-spin text-primary" />
              )}
              <p className="font-medium">{phase === "locating" ? "Checking your location…" : "Checking you in…"}</p>
            </CardContent>
          </Card>
        ) : null}

        {phase === "done" && result ? (
          <ResultCard
            result={result}
            problem={problem}
            onAgain={() => {
              setResult(null);
              setPhase("scanning");
            }}
            onDone={() => router.push("/")}
          />
        ) : null}

        {isDev ? (
          <Card className="border-dashed">
            <CardContent className="space-y-2 py-4 text-sm">
              <p className="font-semibold">Developer tools (not in production)</p>
              <Textarea
                placeholder="Paste a BNID1. token from the kiosk screen"
                value={devToken}
                onChange={(e) => setDevToken(e.target.value)}
              />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={devAtVenue} onChange={(e) => setDevAtVenue(e.target.checked)} />
                Pretend I&apos;m at the venue
              </label>
              <Button size="sm" variant="outline" disabled={!devToken} onClick={() => submit(devToken.trim())}>
                Check in with pasted token
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </TabsContent>

      <TabsContent value="pass">
        <MemberPass memberId={memberId} deviceId={local.device.id} />
      </TabsContent>
    </Tabs>
  );
}

function ResultCard({
  result,
  problem,
  onAgain,
  onDone,
}: {
  result: CheckinResult;
  problem: string;
  onAgain: () => void;
  onDone: () => void;
}) {
  if (result.ok) {
    const late = result.status === "L";
    return (
      <Card className={late ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2Icon className={`size-16 ${late ? "text-amber-600" : "text-green-600"}`} />
          <div>
            <p className="text-xl font-bold">
              {result.already ? "Already checked in" : late ? "Checked in — Late" : "Checked in — On time"}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.meetingTitle} · {formatTime(new Date(result.checkedInAt))}
            </p>
          </div>
          <Button className="mt-2 w-full max-w-xs" onClick={onDone}>
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }
  const message = REJECTION_MESSAGES[result.reason] ?? "Check-in failed.";
  return (
    <Card className="border-red-300 bg-red-50">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <XCircleIcon className="size-14 text-red-600" />
        <p className="font-semibold">{message}</p>
        {result.reason === "too_far" && result.distanceM ? (
          <p className="text-sm text-muted-foreground">You are about {formatDistance(result.distanceM)} from the venue.</p>
        ) : null}
        {problem ? <p className="text-sm text-muted-foreground">{problem}</p> : null}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onAgain}>Scan again</Button>
          <Button variant="outline" onClick={onDone}>
            Back to Home
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Still stuck? Open &quot;My check-in pass&quot; and show it to the LVH team.
        </p>
      </CardContent>
    </Card>
  );
}
