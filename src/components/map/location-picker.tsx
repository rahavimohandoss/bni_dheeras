"use client";

import { LocateFixedIcon, Loader2Icon, SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBestPosition } from "@/lib/geolocation";
import type { LatLng } from "./map-picker-inner";

const MapPickerInner = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-xl bg-muted" />,
});

export type PickedPlace = LatLng & { address?: string; area?: string | null; city?: string | null };

type SearchResult = { label: string; lat: number; lng: number; area: string | null; city: string | null };

/**
 * Search an address, use the phone's location, or tap/drag the pin. Reverse
 * geocoding fills in the area and city after the pin moves.
 */
export function LocationPicker({
  value,
  onChange,
  radiusM,
  height,
}: {
  value: PickedPlace | null;
  onChange: (p: PickedPlace) => void;
  radiusM?: number | null;
  height?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<"search" | "gps" | null>(null);

  async function reverse(p: LatLng) {
    onChange({ lat: p.lat, lng: p.lng });
    try {
      const res = await fetch(`/api/geocode?lat=${p.lat}&lng=${p.lng}`);
      if (!res.ok) return;
      const { place } = (await res.json()) as { place: SearchResult };
      onChange({ ...p, address: place.label, area: place.area, city: place.city });
    } catch {
      // keep the pin even if the address lookup fails
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setBusy("search");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      if (data.results.length === 0) toast.info("No matches. Try a landmark or area name, or drop the pin on the map.");
    } catch (err) {
      toast.error((err as Error).message || "Search failed.");
    } finally {
      setBusy(null);
    }
  }

  async function useMyLocation() {
    setBusy("gps");
    try {
      const fix = await getBestPosition({ maxWaitMs: 10000, goodEnoughM: 25 });
      await reverse({ lat: fix.lat, lng: fix.lng });
      if (fix.accuracy > 60) toast.info(`Location is approximate (±${Math.round(fix.accuracy)} m). Drag the pin to the exact spot.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search address or landmark" />
        <Button type="submit" variant="outline" disabled={busy !== null}>
          {busy === "search" ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </form>
      {results.length ? (
        <div className="divide-y rounded-lg border text-sm">
          {results.map((r) => (
            <button
              type="button"
              key={`${r.lat},${r.lng}`}
              className="block w-full px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                onChange({ lat: r.lat, lng: r.lng, address: r.label, area: r.area, city: r.city });
                setResults([]);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={busy !== null}>
        {busy === "gps" ? <Loader2Icon className="animate-spin" /> : <LocateFixedIcon />}
        Use my current location
      </Button>
      <MapPickerInner value={value} onChange={reverse} radiusM={radiusM} height={height} />
      <p className="text-xs text-muted-foreground">Tap the map or drag the pin to the exact spot.</p>
    </div>
  );
}
