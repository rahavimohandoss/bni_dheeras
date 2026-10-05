"use client";

import { CheckCircle2Icon, Clock3Icon, Loader2Icon, ShieldAlertIcon, SmartphoneIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { registerDevice } from "@/actions/device";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signedPayload } from "@/lib/attendance/payloads";
import {
  describeThisDevice,
  deviceCryptoAvailable,
  deviceThumbprint,
  getDeviceKey,
  getOrCreateDeviceKey,
  signWithDevice,
} from "@/lib/device-key";

export type DeviceSummary = {
  id: string;
  thumbprint: string;
  status: "pending" | "approved" | "revoked";
  label: string;
  approvalCode: string;
};

export type LocalDeviceState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "unregistered" }
  | { kind: "pending"; device: DeviceSummary }
  | { kind: "approved"; device: DeviceSummary }
  | { kind: "revoked"; device: DeviceSummary };

/** Works out how THIS browser's key relates to the member's registered devices. */
export function useLocalDevice(devices: DeviceSummary[]): [LocalDeviceState, (s: LocalDeviceState) => void] {
  const [state, setState] = useState<LocalDeviceState>({ kind: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!deviceCryptoAvailable()) return setState({ kind: "unsupported" });
      const key = await getDeviceKey().catch(() => null);
      if (!key) return !cancelled && setState({ kind: "unregistered" });
      const tp = await deviceThumbprint(key.publicJwk);
      const match = devices.find((d) => d.thumbprint === tp);
      if (cancelled) return;
      if (!match) setState({ kind: "unregistered" });
      else setState({ kind: match.status, device: match });
    })();
    return () => {
      cancelled = true;
    };
  }, [devices]);
  return [state, setState];
}

export function DeviceCard({ memberId, devices }: { memberId: string; devices: DeviceSummary[] }) {
  const [state, setState] = useLocalDevice(devices);
  const [busy, setBusy] = useState(false);
  const approvedElsewhere = devices.find((d) => d.status === "approved");

  async function register() {
    setBusy(true);
    try {
      const key = await getOrCreateDeviceKey();
      const ts = Date.now();
      const signature = await signWithDevice(signedPayload.register(memberId, ts));
      const res = await registerDevice({ jwk: key.publicJwk, ts, signature, label: describeThisDevice() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const thumbprint = await deviceThumbprint(key.publicJwk);
      const device: DeviceSummary = {
        id: res.data.deviceId,
        thumbprint,
        status: res.data.status,
        label: describeThisDevice(),
        approvalCode: res.data.approvalCode,
      };
      setState({ kind: res.data.status, device });
      toast.success(res.data.status === "approved" ? "This phone is approved." : "Registered. Ask for approval.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Checking this phone…
        </CardContent>
      </Card>
    );
  }
  if (state.kind === "approved") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2Icon className="size-6 shrink-0 text-green-700" />
          <div className="text-sm">
            <div className="font-semibold text-green-900">This phone is approved for check-in</div>
            <div className="text-green-800">{state.device.label}</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (state.kind === "pending") {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-center gap-4 py-4">
          <Clock3Icon className="size-6 shrink-0 text-amber-700" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-amber-900">Waiting for approval</div>
            <div className="text-amber-900/80">
              Show this code to the Attendance Coordinator or Secretary. You can use everything except check-in until
              then.
            </div>
          </div>
          <div className="rounded-lg bg-white px-3 py-2 text-center font-mono text-2xl font-bold tracking-widest text-amber-900">
            {state.device.approvalCode}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (state.kind === "unsupported") {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center gap-3 py-4 text-sm">
          <ShieldAlertIcon className="size-6 shrink-0 text-red-700" />
          This browser can&apos;t register a device. Open the app over HTTPS in Chrome (Android) or Safari (iPhone).
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <SmartphoneIcon className="hidden size-6 shrink-0 text-primary sm:block" />
        <div className="flex-1 text-sm">
          <div className="font-semibold">
            {state.kind === "revoked" ? "This phone's registration was removed" : "Register this phone for check-in"}
          </div>
          <div className="text-muted-foreground">
            {approvedElsewhere
              ? `Your approved phone is "${approvedElsewhere.label}". Registering this one needs approval, and the old one then stops working.`
              : "Each member checks in from one approved phone. On iPhone, add the app to your Home Screen first and register from there."}
          </div>
        </div>
        <Button onClick={register} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : null}
          Register this phone
        </Button>
      </CardContent>
    </Card>
  );
}
