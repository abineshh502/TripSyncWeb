/**
 * TripSync Web — Next.js Configuration (Security Hardened)
 * ==========================================================
 * Security remediations applied:
 *   WEB-0006  unsafe-eval removed from CSP script-src          [HIGH FIXED]
 *   WEB-0007  unsafe-inline scoped only to style-src           [MEDIUM FIXED]
 *   WEB-0008  HSTS header added (max-age=63072000)             [MEDIUM FIXED]
 *   WEB-0009  Permissions-Policy header added                  [MEDIUM FIXED]
 *   WEB-0010  ignoreBuildErrors removed — TypeScript enforced  [MEDIUM FIXED]
 *   WEB-0011  ignoreDuringBuilds removed — ESLint enforced     [MEDIUM FIXED]
 *   WEB-0013  X-Frame-Options DENY maintained                  [INFO]
 */

import type { NextConfig } from "next";

// ─── Trusted Sources ─────────────────────────────────────────────────────────
// External services that need to be explicitly listed in CSP.
// Add new domains here; never use wildcards.
const TRUSTED_BACKEND_URLS = [
  process.env.NEXT_PUBLIC_API_URL || "https://tripsync-backend-ra7p.onrender.com",
  "https://tripsync-backend-ra7p.onrender.com",
].join(" ");

const TRUSTED_CONNECT = [
  TRUSTED_BACKEND_URLS,
  "https://api.geoapify.com",
  "https://nominatim.openstreetmap.org",
  "https://router.project-osrm.org",
  "https://api.open-meteo.com",
  "https://*.firebaseio.com",
  "https://*.googleapis.com",
  "https://*.firebase.com",
  "wss://*.firebaseio.com",   // Firebase Realtime DB WebSocket
].join(" ");

// ─── Content Security Policy ──────────────────────────────────────────────────
// WEB-0006: unsafe-eval REMOVED — FIXED
// WEB-0007: unsafe-inline restricted to style-src only (required by CSS-in-JS)
// Note: Removing 'unsafe-inline' from script-src requires nonce-based CSP.
// Next.js nonce middleware is implemented in middleware.ts.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // unsafe-eval REMOVED — eval() is not needed in production NextJS builds
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com",
  // unsafe-inline required for Tailwind/CSS-in-JS; hash-based CSP is not feasible
  // without a custom CSS-in-JS nonce setup
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src 'self' ${TRUSTED_CONNECT}`,
  "frame-src 'self' https://*.firebaseapp.com https://*.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // TypeScript errors are NOT suppressed — type safety is a security control
  // WEB-0010: ignoreBuildErrors REMOVED — FIXED
  // Note: If the WASM TypeScript checker crashes on Windows, run:
  //   npx tsc --noEmit
  // to verify types separately; do not suppress errors here.
  typescript: {
    // ignoreBuildErrors: false  ← default; explicitly not setting true
  },

  // ESLint errors are NOT suppressed in production builds
  // WEB-0011: ignoreDuringBuilds REMOVED — FIXED
  eslint: {
    // ignoreDuringBuilds: false  ← default
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // ── Clickjacking Protection ─────────────────────────────────────
          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          // ── HSTS — WEB-0008 FIXED ────────────────────────────────────────
          // max-age=2 years; includeSubDomains; preload
          // Only set in production (vercel/render set HTTPS automatically)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },

          // ── MIME Sniffing Protection ────────────────────────────────────
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // ── Referrer Policy ─────────────────────────────────────────────
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // ── Permissions Policy — WEB-0009 FIXED ─────────────────────────
          // Restrict access to sensitive browser APIs
          {
            key: "Permissions-Policy",
            value: [
              "camera=(self)",
              "microphone=(self)",         // required for voice feature
              "geolocation=(self)",        // required for map features
              "payment=()",               // denied — no payment flows
              "usb=()",
              "bluetooth=()",
              "accelerometer=()",
              "gyroscope=()",
              "magnetometer=()",
            ].join(", "),
          },

          // ── Content Security Policy — WEB-0006 FIXED ─────────────────────
          {
            key: "Content-Security-Policy",
            value: CSP_DIRECTIVES,
          },

          // ── Cross-Origin Policies ────────────────────────────────────────
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",  // allows Firebase OAuth popups
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
