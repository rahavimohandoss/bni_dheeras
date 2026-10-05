export type Fix = { lat: number; lng: number; accuracy: number };

export class GeoError extends Error {
  constructor(
    message: string,
    public code: "denied" | "unavailable" | "timeout" | "unsupported",
  ) {
    super(message);
  }
}

/**
 * Best GPS fix within `maxWaitMs`. Phones often report a coarse fix first, so
 * we watch for a few seconds and keep the most accurate reading, returning
 * early once it is good enough.
 */
export function getBestPosition({ maxWaitMs = 8000, goodEnoughM = 30 } = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeoError("This browser can't share location.", "unsupported"));
      return;
    }
    let best: Fix | null = null;
    let done = false;
    const finish = (fix: Fix | null, err?: GeoError) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (fix) resolve(fix);
      else reject(err ?? new GeoError("Couldn't get your location. Try again near a window.", "timeout"));
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= goodEnoughM) finish(fix);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          finish(
            null,
            new GeoError(
              "Location permission is blocked. Allow location for this app in your phone settings, then try again.",
              "denied",
            ),
          );
        } else if (!best && err.code === err.POSITION_UNAVAILABLE) {
          finish(null, new GeoError("Location is unavailable. Turn on GPS / Location services.", "unavailable"));
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs },
    );
    const timer = setTimeout(() => finish(best), maxWaitMs);
  });
}
