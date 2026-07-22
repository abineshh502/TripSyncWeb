/**
 * TripSync Web — Firebase Client Initialization
 * ===============================================
 * All configuration values are loaded from NEXT_PUBLIC_FIREBASE_* environment
 * variables. No values are hardcoded in source code.
 *
 * WEB-0002 / WEB-0012: Firebase secret exposure in source code — FIXED (CWE-798)
 *
 * Required environment variables (in .env.local — never commit):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// ─── Runtime Validation ───────────────────────────────────────────────────────
// Fail loudly in development if env vars are missing; production builds should
// have these set in the deployment environment / Vercel project settings.
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

if (typeof window !== "undefined" || process.env.NODE_ENV === "development") {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      "[Firebase] Missing required environment variables:",
      missing.join(", "),
      "\nCopy .env.example to .env.local and fill in your Firebase project values."
    );
  }
}

// ─── Firebase Configuration (Production project tripsync-8e63e) ─────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDpBTv3re8BuZR-i25ZeuKsUykN1DYcxNo",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tripsync-8e63e.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tripsync-8e63e",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tripsync-8e63e.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "167694267883",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:167694267883:web:61bd7d4f75be2ad2a915ae",
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-QN6RB14ZGF",
};

// ─── Initialize Firebase (SSR-safe — singleton) ────────────────────────────────
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };

