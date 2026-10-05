/**
 * Public base URL of the app, e.g. https://dheeras.example.com. Uses
 * NEXT_PUBLIC_APP_URL when set, otherwise Vercel's production domain.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelProd ? `https://${vercelProd}` : "";
}

/** Every origin this deployment may be reached on (production, this deployment, its branch URL). */
export function trustedOrigins(): string[] {
  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ].filter(Boolean);
  return [
    ...new Set(
      [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL, ...hosts.map((h) => `https://${h}`)]
        .filter((u): u is string => !!u)
        .map((u) => u.replace(/\/+$/, "")),
    ),
  ];
}
