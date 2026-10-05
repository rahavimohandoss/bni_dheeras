"use client";

import { MaximizeIcon, WifiOffIcon } from "lucide-react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { formatTime } from "@/lib/time";

type KioskState = {
  meeting: {
    title: string;
    startsAt: string;
    endsAt: string;
    checkinOpensAt: string;
    status: string;
    window: "open" | "not_open_yet" | "closed";
    venue: string | null;
  };
  token: string | null;
  windowSeconds: number;
  msUntilNext: number;
  stats: { in: number; expected: number };
  recent: { name: string; photoUrl: string | null; at: string }[];
};

const POLL_MS = 2000;

/**
 * The venue screen. Polls the server for the current QR token (it changes every
 * 15 s), shows a countdown, the check-in count and a welcome ticker so the
 * whole room sees who has checked in.
 */
export function KioskDisplay({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [state, setState] = useState<(KioskState & { fetchedAt: number }) | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/kiosk/${meetingId}/state`, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/kiosk");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: KioskState = await res.json();
        setState({ ...data, fetchedAt: Date.now() });
        setOffline(false);
        if (data.token !== lastToken.current) {
          lastToken.current = data.token;
          setQr(
            data.token
              ? await QRCode.toDataURL(data.token, { margin: 1, width: 900, errorCorrectionLevel: "M" })
              : null,
          );
        }
      } catch {
        setOffline(true);
      }
      if (!stop) timer = setTimeout(poll, POLL_MS);
    }
    poll();
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [meetingId, router]);

  const secondsLeft = state
    ? Math.max(0, Math.ceil((state.msUntilNext - (now - state.fetchedAt)) / 1000))
    : 0;
  const progress = state ? secondsLeft / state.windowSeconds : 0;

  return (
    <main className="flex min-h-dvh flex-col bg-white text-neutral-900 lg:flex-row">
      <section className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <div className="text-sm font-semibold tracking-widest text-primary uppercase">BNI Dheeras · Check in</div>
          <h1 className="text-3xl font-bold lg:text-4xl">{state?.meeting.title ?? "Loading…"}</h1>
          {state ? (
            <p className="text-neutral-500">
              Starts {formatTime(new Date(state.meeting.startsAt))}
              {state.meeting.venue ? ` · ${state.meeting.venue}` : ""}
            </p>
          ) : null}
        </div>

        {offline ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-lg font-semibold text-white">
            <WifiOffIcon /> Screen offline — LVH, use member passes
          </div>
        ) : null}

        {state && state.meeting.status !== "scheduled" ? (
          <Message text="Check-in is closed for this meeting." />
        ) : state?.meeting.window === "not_open_yet" ? (
          <Message text={`Check-in opens at ${formatTime(new Date(state.meeting.checkinOpensAt))}`} />
        ) : state?.meeting.window === "closed" ? (
          <Message text="Check-in has closed. Please see the LVH team." />
        ) : qr ? (
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="Check-in QR code"
              className="aspect-square w-[min(70vh,80vw)] max-w-[720px] rounded-2xl border-8 border-white shadow-xl"
            />
            <div className="flex w-[min(70vh,80vw)] max-w-[720px] items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="w-24 text-right text-sm text-neutral-500 tabular-nums">New code in {secondsLeft}s</span>
            </div>
            <p className="text-lg text-neutral-600">
              Open the BNI Dheeras app → <b>Check in</b> → scan this code
            </p>
          </div>
        ) : (
          <div className="aspect-square w-[min(70vh,80vw)] max-w-[720px] animate-pulse rounded-2xl bg-neutral-100" />
        )}
      </section>

      <aside className="flex w-full flex-col gap-4 border-t bg-neutral-50 p-6 lg:w-[380px] lg:border-t-0 lg:border-l">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-5xl font-bold tabular-nums">
              {state?.stats.in ?? 0}
              <span className="text-2xl text-neutral-400"> / {state?.stats.expected ?? 0}</span>
            </div>
            <div className="text-sm text-neutral-500">members checked in</div>
          </div>
          <button
            type="button"
            className="rounded-lg border p-2 text-neutral-500 hover:text-neutral-900"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            title="Full screen"
          >
            <MaximizeIcon className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {state?.recent.map((r, i) => (
            <div
              key={`${r.name}-${r.at}`}
              className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ${i === 0 ? "ring-2 ring-primary/40" : ""}`}
            >
              <MemberAvatar name={r.name} src={r.photoUrl} className="size-12" />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">Welcome, {r.name.split(" ")[0]}!</div>
                <div className="truncate text-sm text-neutral-500">
                  {r.name} · {formatTime(new Date(r.at))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex aspect-square w-[min(60vh,80vw)] max-w-[640px] items-center justify-center rounded-2xl bg-neutral-100 p-10 text-center text-2xl font-semibold text-neutral-600">
      {text}
    </div>
  );
}
