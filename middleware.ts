/**
 * TripSync Web — Next.js Middleware (Server-Side Route Protection)
 * =================================================================
 * Runs on the Edge Runtime for every matching request, before any page
 * component or API route handler executes.
 *
 * WEB-0013: Missing Server-Side Middleware — FIXED (CWE-285)
 * WEB-0004: Client-Side Auth Guard Only — FIXED
 *
 * Strategy:
 *  - Public routes (/, /login, /signup, /api/auth/*, /public/*) are allowed.
 *  - All other routes require a valid Firebase session cookie.
 *  - If the cookie is absent the request is redirected to /login.
 *  - Token signature verification is handled by Firebase Admin SDK on the
 *    API layer; middleware only checks cookie presence as a fast gate.
 *    Full token verification for sensitive operations happens in API routes.
 *
 * NOTE: Full Firebase Admin token verification in Edge middleware requires
 * the firebase-admin SDK to support Edge runtime, which as of 2025 requires
 * the `firebase/app-check` + `firebase-admin` v12+ with Node.js runtime.
 * For edge-compatible verification, we use a lightweight cookie check here
 * and enforce full token verification in API routes and server components.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Public Routes (no authentication required) ───────────────────────────────
const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/login(\/.*)?$/,
  /^\/signup(\/.*)?$/,
  /^\/forgot-password(\/.*)?$/,
  /^\/api\/auth\/.*/,
  /^\/_next\/.*/,
  /^\/favicon\.ico$/,
  /^\/public\/.*/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

// ─── Session Cookie Name ──────────────────────────────────────────────────────
// Firebase sets this cookie when session persistence is "SESSION" or when
// you manually set it in an API route after verifying the ID token.
// The cookie name must match what your auth flow sets.
const SESSION_COOKIE_NAME = "__session";
// Firebase Auth also uses this in the client SDK
const FIREBASE_AUTH_COOKIE = "firebase-auth-token";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always allow public paths without any auth check
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie (set by Firebase Auth client SDK or custom auth flow)
  const sessionCookie =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ||
    request.cookies.get(FIREBASE_AUTH_COOKIE)?.value;

  // If no session cookie, redirect to login
  if (!sessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);

    const response = NextResponse.redirect(loginUrl);

    // Clear any stale auth cookies on redirect
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(FIREBASE_AUTH_COOKIE);

    return response;
  }

  // Session cookie is present — allow the request.
  // Full token verification happens in API routes and server components.
  const response = NextResponse.next();

  // Add security headers to all protected route responses
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");

  return response;
}

// ─── Matcher Configuration ────────────────────────────────────────────────────
// Apply middleware to all routes except Next.js internals and static files.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
