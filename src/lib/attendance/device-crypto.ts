import { createHash, webcrypto } from "node:crypto";

/**
 * Server-side checks for device keys. A member's phone holds a non-extractable
 * ECDSA P-256 private key in IndexedDB. The server only ever sees the public
 * JWK, identified by its RFC 7638 thumbprint.
 */

export type EcPublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string };

const B64URL = /^[A-Za-z0-9_-]+$/;

/** Accepts only a P-256 public key; rejects anything carrying a private part. */
export function parsePublicJwk(value: unknown): EcPublicJwk | null {
  if (!value || typeof value !== "object") return null;
  const jwk = value as Record<string, unknown>;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk) return null;
  if (typeof jwk.x !== "string" || typeof jwk.y !== "string") return null;
  if (!B64URL.test(jwk.x) || !B64URL.test(jwk.y) || jwk.x.length !== 43 || jwk.y.length !== 43) return null;
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
}

/** RFC 7638 JWK thumbprint (SHA-256, base64url). */
export function jwkThumbprint(jwk: EcPublicJwk): string {
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`;
  return createHash("sha256").update(canonical).digest("base64url");
}

/** Verifies an IEEE P1363 (r||s) ECDSA-SHA256 signature made by WebCrypto. */
export async function verifyDeviceSignature(
  jwk: EcPublicJwk,
  payload: string,
  signatureB64url: string,
): Promise<boolean> {
  try {
    const signature = Buffer.from(signatureB64url, "base64url");
    if (signature.length !== 64) return false;
    const key = await webcrypto.subtle.importKey(
      "jwk",
      { ...jwk, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}
