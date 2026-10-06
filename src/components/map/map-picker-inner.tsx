"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { BaseTiles, DEFAULT_CENTER, pinIcon } from "./leaflet-base";

export type LatLng = { lat: number; lng: number };

function ClickToMove({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ point }: { point: LatLng | null }) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (!point) return;
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (key === last.current) return;
    last.current = key;
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [point, map]);
  return null;
}

export default function MapPickerInner({
  value,
  onChange,
  height = 320,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  height?: number;
}) {
  const icon = useMemo(() => pinIcon(), []);
  const markerRef = useRef<LeafletMarker>(null);
  const handlers = useMemo(
    () => ({
      dragend() {
        const ll = markerRef.current?.getLatLng();
        if (ll) onChange({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : DEFAULT_CENTER}
      zoom={value ? 16 : 13}
      scrollWheelZoom
      style={{ height, width: "100%", borderRadius: 12 }}
    >
      <BaseTiles />
      <ClickToMove onPick={onChange} />
      <FlyTo point={value} />
      {value ? (
        <Marker position={[value.lat, value.lng]} draggable icon={icon} ref={markerRef} eventHandlers={handlers} />
      ) : null}
    </MapContainer>
  );
}
