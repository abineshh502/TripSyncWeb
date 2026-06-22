/**
 * shareUtils.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Central utility for generating share URLs.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL env variable (set in .env.local for dev, set in
 *     Vercel / hosting dashboard for production)
 *  2. window.location.origin (fallback for browser context)
 *  3. http://localhost:3000 (final safety fallback)
 *
 * NEVER hardcode a production domain like tripsync.io here.
 */

/** Returns the canonical base URL for this deployment */
export function getAppBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://tripsync.example.com";
}

/**
 * Generate a shareable trip view URL.
 * Route: /trips/view?id=<tripId>
 */
export function buildTripShareUrl(tripId: string): string {
  if (!tripId || !tripId.trim()) return "";
  return `${getAppBaseUrl()}/trips/view?id=${encodeURIComponent(tripId.trim())}`;
}

/**
 * Generate a shareable route (map builder) URL.
 * Route: /routes/<routeId>   (existing dynamic page)
 */
export function buildRouteShareUrl(routeId: string): string {
  if (!routeId || !routeId.trim()) return "";
  const cleanId = routeId.trim().split("/").pop() || routeId.trim();
  return `${getAppBaseUrl()}/routes/${cleanId}`;
}

/** Validate that a share link is correctly formed (no double-slashes, valid host) */
export function validateShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must have a host and a valid path segment after it
    return parsed.host.length > 0 && !parsed.pathname.includes("//");
  } catch {
    return false;
  }
}
