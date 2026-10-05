/**
 * Browser-side device identity. On first use the phone generates an ECDSA P-256
 * key pair with a NON-extractable private key and keeps it in IndexedDB. Script
 * can ask the browser to sign with it, but the key itself can never be read,
 * copied or sent anywhere. Clearing site data destroys it (a new device then
 * needs approval again).
 */

export type DevicePublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };
type StoredKey = { privateKey: CryptoKey; publicJwk: DevicePublicJwk; createdAt: number };

const DB_NAME = "bni-dheeras";
const STORE = "keys";
const KEY_ID = "device-key-v1";

export function deviceCryptoAvailable(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const database = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    database.close();
  }
}

export async function getDeviceKey(): Promise<StoredKey | null> {
  if (!deviceCryptoAvailable()) return null;
  return ((await idb<StoredKey | undefined>("readonly", (s) => s.get(KEY_ID))) ?? null) as StoredKey | null;
}

async function createKey(): Promise<StoredKey> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const stored: StoredKey = {
    privateKey: pair.privateKey,
    publicJwk: { kty: "EC", crv: "P-256", x: jwk.x!, y: jwk.y! },
    createdAt: Date.now(),
  };
  await idb("readwrite", (s) => s.put(stored, KEY_ID));
  // Ask the browser not to evict this site's storage under pressure.
  await navigator.storage?.persist?.().catch(() => false);
  return stored;
}

/** Returns this phone's key, creating it once (guarded against two open tabs). */
export async function getOrCreateDeviceKey(): Promise<StoredKey> {
  if (!deviceCryptoAvailable()) {
    throw new Error("This browser can't register a device. Open the app over HTTPS in Chrome or Safari.");
  }
  const run = async () => (await getDeviceKey()) ?? (await createKey());
  if (navigator.locks?.request) {
    return navigator.locks.request("bni-device-key", run);
  }
  return run();
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signWithDevice(payload: string): Promise<string> {
  const key = await getDeviceKey();
  if (!key) throw new Error("This phone isn't registered yet.");
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key.privateKey,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(sig);
}

/** Same RFC 7638 thumbprint the server computes, to identify this phone. */
export async function deviceThumbprint(jwk: DevicePublicJwk): Promise<string> {
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  return toBase64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)));
}

/** A readable label like "iPhone · Safari" for approvers. */
export function describeThisDevice(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? (ua.match(/Android [^;]+;\s*([^;)]+)/)?.[1]?.trim() ?? "Android")
        : /Windows/.test(ua)
          ? "Windows PC"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : "Device";
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /CriOS|Chrome/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : "Browser";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  return `${os} · ${browser}${standalone ? " (app)" : ""}`;
}
