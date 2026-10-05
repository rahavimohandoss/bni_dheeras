"use client";

import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import { initials } from "@/components/member-avatar";
import { avatarIcon, BaseTiles } from "@/components/map/leaflet-base";
import { formatDistance } from "@/lib/attendance/geo";
import type { NearbyMember } from "@/lib/nearby";

type Origin = { lat: number; lng: number; label: string };

function FitAll({ origin, members }: { origin: Origin; members: NearbyMember[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [[origin.lat, origin.lng], ...members.map((m) => [m.lat, m.lng] as [number, number])];
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [map, origin, members]);
  return null;
}

export default function NearMap({ origin, members }: { origin: Origin; members: NearbyMember[] }) {
  const meIcon = useMemo(() => avatarIcon({ initials: "You", me: true, size: 44 }), []);
  return (
    <MapContainer center={[origin.lat, origin.lng]} zoom={13} scrollWheelZoom style={{ height: "60vh", width: "100%", borderRadius: 12 }}>
      <BaseTiles />
      <FitAll origin={origin} members={members} />
      <Marker position={[origin.lat, origin.lng]} icon={meIcon} zIndexOffset={1000}>
        <Popup>{origin.label}</Popup>
      </Marker>
      {members.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={avatarIcon({ photoUrl: m.photoUrl, initials: initials(m.name) })}>
          <Popup>
            <div className="min-w-44 space-y-1 text-sm">
              <div className="font-semibold">{m.name}</div>
              <div>
                {m.business}
                {m.category ? ` · ${m.category}` : ""}
              </div>
              <div className="text-neutral-500">
                {m.precision === "area" ? "~" : ""}
                {formatDistance(m.distanceM)} away{m.area ? ` · ${m.area}` : ""}
              </div>
              <div className="flex gap-3 pt-1">
                <Link href={`/members/${m.id}`}>Profile</Link>
                {m.phone ? <a href={`tel:${m.phone}`}>Call</a> : null}
                {m.precision === "exact" ? (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`} target="_blank" rel="noopener">
                    Directions
                  </a>
                ) : null}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
