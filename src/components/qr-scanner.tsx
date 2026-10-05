"use client";

import { CameraOffIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

/** Native BarcodeDetector where it supports QR (Android Chrome), else the self-hosted WASM decoder. */
function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } })
      .BarcodeDetector;
    if (Native) {
      try {
        if ((await Native.getSupportedFormats()).includes("qr_code")) return new Native({ formats: ["qr_code"] });
      } catch {
        // fall through to the ponyfill
      }
    }
    const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/wasm/${path}` : prefix + path),
      },
    });
    return new BarcodeDetector({ formats: ["qr_code"] }) as unknown as Detector;
  })();
  return detectorPromise;
}

/**
 * Live camera QR scanner. Only reads from the camera (no image upload), calls
 * `onScan` once for the first code that `accept` allows, then stops.
 */
export function QrScanner({
  onScan,
  accept,
  facingMode = "environment",
}: {
  onScan: (value: string) => void;
  accept: (value: string) => boolean;
  facingMode?: "environment" | "user";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const onScanRef = useRef(onScan);
  const acceptRef = useRef(accept);
  useEffect(() => {
    onScanRef.current = onScan;
    acceptRef.current = accept;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("error");
        setError("Camera isn't available here. Open the app over HTTPS in Chrome or Safari.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        const name = (e as DOMException).name;
        setState("error");
        setError(
          name === "NotAllowedError"
            ? "Camera permission is blocked. Allow camera access for this app in your browser settings, then reopen this page."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Couldn't start the camera. Close other apps using it and try again.",
        );
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const detector = await getDetector();
      setState("scanning");

      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video);
            for (const code of codes) {
              if (acceptRef.current(code.rawValue)) {
                stopped = true;
                stream?.getTracks().forEach((t) => t.stop());
                onScanRef.current(code.rawValue);
                return;
              }
              setHint("That QR isn't the right one.");
            }
          }
        } catch {
          // a frame failed to decode; keep going
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    }

    start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  if (state === "error") {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl bg-muted p-6 text-center">
        <CameraOffIcon className="size-10 text-muted-foreground" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      {state === "starting" ? (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Loader2Icon className="size-8 animate-spin" />
        </div>
      ) : null}
      {hint ? (
        <div className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">{hint}</div>
      ) : null}
    </div>
  );
}
