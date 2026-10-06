"use client";

import { ListIcon, Loader2Icon, LocateFixedIcon, MapIcon, MessageCircleIcon, NavigationIcon, PhoneIcon, StoreIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { nearbyFromHere } from "@/actions/location";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance } from "@/lib/geo";
import { getBestPosition } from "@/lib/geolocation";
import type { NearbyMember } from "@/lib/nearby";
import { cn } from "@/lib/utils";

const NearMap = dynamic(() => import("./near-map"), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse rounded-xl bg-muted" />,
});

type Origin = { lat: number; lng: number; label: string };

const BANDS = [
  { max: 2000, label: "Within 2 km" },
  { max: 5000, label: "2–5 km" },
  { max: 10000, label: "5–10 km" },
  { max: Infinity, label: "10 km and beyond" },
];
const LIMITS = [
  { value: Infinity, label: "All" },
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
];
const VIEW_KEY = "bni-near-view";

// The List/Map choice is remembered per phone (localStorage), read via useSyncExternalStore.
const viewListeners = new Set<() => void>();
function subscribeView(cb: () => void) {
  viewListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    viewListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readView(): "list" | "map" {
  try {
    return localStorage.getItem(VIEW_KEY) === "map" ? "map" : "list";
  } catch {
    return "list";
  }
}
function writeView(v: "list" | "map") {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
  viewListeners.forEach((l) => l());
}

/** One GPS reading, then the nearest-first list from there. The position isn't stored. */
async function fetchFromHere(): Promise<{ origin: Origin; list: NearbyMember[] }> {
  const fix = await getBestPosition({ maxWaitMs: 8000, goodEnoughM: 50 });
  const res = await nearbyFromHere({ lat: fix.lat, lng: fix.lng });
  if (!res.ok) throw new Error(res.error);
  return { origin: { lat: fix.lat, lng: fix.lng, label: "You are here" }, list: res.data };
}

export function NearMe({ business, initial }: { business: Origin | null; initial: NearbyMember[] | null }) {
  const view = useSyncExternalStore(subscribeView, readView, () => "list" as const);
  const [from, setFrom] = useState<"business" | "gps">(business ? "business" : "gps");
  const [gps, setGps] = useState<{ origin: Origin; list: NearbyMember[] } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [clickLocating, setClickLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(Infinity);

  async function locate() {
    setFrom("gps");
    if (gps) return;
    setClickLocating(true);
    try {
      setGps(await fetchFromHere());
      setGpsError(null);
    } catch (e) {
      toast.error((e as Error).message);
      setGpsError((e as Error).message);
      if (business) setFrom("business");
    } finally {
      setClickLocating(false);
    }
  }

  // No business location saved: start from the phone's position.
  useEffect(() => {
    if (business) return;
    let cancelled = false;
    fetchFromHere()
      .then((r) => !cancelled && setGps(r))
      .catch((e: Error) => !cancelled && setGpsError(e.message));
    return () => {
      cancelled = true;
    };
  }, [business]);

  const locating = clickLocating || (from === "gps" && !gps && !gpsError);
  const origin = from === "business" ? business : (gps?.origin ?? null);
  const list = useMemo(() => {
    const all = from === "business" ? (initial ?? []) : (gps?.list ?? []);
    const q = query.trim().toLowerCase();
    return all.filter(
      (m) =>
        m.distanceM <= limit &&
        (!q || [m.name, m.business, m.category, m.area].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [from, initial, gps, query, limit]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <Toggle active={from === "business"} disabled={!business} onClick={() => setFrom("business")}>
            <StoreIcon className="size-4" /> From my business
          </Toggle>
          <Toggle active={from === "gps"} onClick={locate}>
            {locating ? <Loader2Icon className="size-4 animate-spin" /> : <LocateFixedIcon className="size-4" />} From where I am
          </Toggle>
        </div>
        <div className="inline-flex rounded-lg border p-0.5 sm:ml-auto">
          <Toggle active={view === "list"} onClick={() => writeView("list")}>
            <ListIcon className="size-4" /> List
          </Toggle>
          <Toggle active={view === "map"} onClick={() => writeView("map")}>
            <MapIcon className="size-4" /> Map
          </Toggle>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name, business or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1">
          {LIMITS.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => setLimit(l.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                limit === l.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {!origin ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {locating ? (
            "Finding your location…"
          ) : (
            <>
              Set your business location or allow location access to see who&apos;s near you.{" "}
              <Link className="text-primary underline" href="/me/location">
                Set my location
              </Link>
            </>
          )}
        </div>
      ) : view === "map" ? (
        <NearMap origin={origin} members={list} />
      ) : (
        <NearList members={list} />
      )}
    </div>
  );
}

function Toggle({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NearList({ members }: { members: NearbyMember[] }) {
  if (members.length === 0) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No members match.</div>;
  }
  const groups = BANDS.map((band, i) => ({
    label: band.label,
    items: members.filter((m) => m.distanceM <= band.max && (i === 0 || m.distanceM > BANDS[i - 1].max)),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            {g.label} · {g.items.length}
          </h2>
          <div className="divide-y rounded-xl border bg-card">
            {g.items.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function directionsUrl(m: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`;
}

function MemberRow({ m }: { m: NearbyMember }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <MemberAvatar name={m.name} src={m.photoUrl} />
        <div className="min-w-0">
          <div className="truncate font-medium">{m.name}</div>
          <div className="truncate text-sm text-muted-foreground">
            {m.business}
            {m.category ? ` · ${m.category}` : ""}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {m.area ?? m.city ?? ""}
            {m.precision === "area" ? " (area only)" : ""}
          </div>
        </div>
      </Link>
      <Badge variant="secondary" className="tabular-nums">
        {m.precision === "area" ? "~" : ""}
        {formatDistance(m.distanceM)}
      </Badge>
      <div className="flex gap-1">
        {m.phone ? (
          <Button asChild variant="ghost" size="icon-sm">
            <a href={`tel:${m.phone}`} aria-label={`Call ${m.name}`}>
              <PhoneIcon />
            </a>
          </Button>
        ) : null}
        {m.whatsapp ? (
          <Button asChild variant="ghost" size="icon-sm">
            <a href={m.whatsapp} target="_blank" rel="noopener" aria-label={`WhatsApp ${m.name}`}>
              <MessageCircleIcon />
            </a>
          </Button>
        ) : null}
        {m.precision === "exact" ? (
          <Button asChild variant="ghost" size="icon-sm">
            <a href={directionsUrl(m)} target="_blank" rel="noopener" aria-label={`Directions to ${m.name}`}>
              <NavigationIcon />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
