export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeofenceInput = {
  distanceM: number;
  accuracyM: number;
  radiusM: number;
  /** Reported GPS inaccuracy forgiven, capped at this many metres. */
  allowanceM: number;
  /** Fixes less accurate than this are refused outright. */
  maxAccuracyM: number;
};

export type GeofenceVerdict = "ok" | "too_far" | "poor_accuracy";

/**
 * Inside the fence if the reported position, moved toward the venue by up to
 * min(accuracy, allowance), lands within the radius.
 */
export function checkGeofence(input: GeofenceInput): GeofenceVerdict {
  if (!Number.isFinite(input.accuracyM) || input.accuracyM > input.maxAccuracyM) return "poor_accuracy";
  const slack = Math.min(Math.max(input.accuracyM, 0), input.allowanceM);
  return input.distanceM - slack <= input.radiusM ? "ok" : "too_far";
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Rounds a point to a ~550 m grid so a home address isn't exposed. */
export function approximatePoint(p: LatLng): LatLng {
  const step = 0.005;
  return {
    lat: Math.round(p.lat / step) * step,
    lng: Math.round(p.lng / step) * step,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}
