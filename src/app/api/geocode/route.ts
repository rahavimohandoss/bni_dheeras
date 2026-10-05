import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/*
 * Free address search through OpenStreetMap Nominatim, proxied by the server.
 * Nominatim's usage policy: at most 1 request per second, an identifying
 * User-Agent, and no autocomplete. Requests are serialised and cached here.
 */

type Place = { label: string; lat: number; lng: number; area: string | null; city: string | null };

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 24 * 3600_000;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

type NominatimAddress = Record<string, string | undefined>;

function areaOf(a: NominatimAddress | undefined): string | null {
  return a?.suburb ?? a?.neighbourhood ?? a?.quarter ?? a?.residential ?? a?.road ?? null;
}
function cityOf(a: NominatimAddress | undefined): string | null {
  return a?.city ?? a?.town ?? a?.village ?? a?.county ?? a?.state_district ?? null;
}

async function nominatim(path: string, params: Record<string, string>) {
  const key = `${path}?${new URLSearchParams(params)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const email = process.env.NOMINATIM_EMAIL;
  const url = `https://nominatim.openstreetmap.org/${path}?${new URLSearchParams({
    ...params,
    format: "jsonv2",
    addressdetails: "1",
    ...(email ? { email } : {}),
  })}`;
  const data = await throttled(async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": `BNI-Dheeras-Chapter-App/1.0${email ? ` (${email})` : ""}`,
        "Accept-Language": "en",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    return res.json();
  });
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return data;
}

export async function GET(req: Request) {
  if (!(await getCurrentMember())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  try {
    const q = searchParams.get("q")?.trim();
    if (q) {
      if (q.length < 3 || q.length > 200) return NextResponse.json({ results: [] });
      const rows = (await nominatim("search", {
        q,
        countrycodes: "in",
        limit: "6",
        // Prefer results around Madurai without excluding the rest of India.
        viewbox: "77.70,10.30,78.50,9.55",
      })) as { display_name: string; lat: string; lon: string; address?: NominatimAddress }[];
      const results: Place[] = rows.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        area: areaOf(r.address),
        city: cityOf(r.address),
      }));
      return NextResponse.json({ results });
    }
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const r = (await nominatim("reverse", { lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: "18" })) as {
        display_name?: string;
        address?: NominatimAddress;
      };
      return NextResponse.json({
        place: { label: r.display_name ?? "", lat, lng, area: areaOf(r.address), city: cityOf(r.address) },
      });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Address search is busy. Try again in a moment, or drop the pin on the map." }, { status: 502 });
  }
}
