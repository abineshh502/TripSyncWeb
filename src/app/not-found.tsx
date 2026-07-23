"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;

      // Dynamic route handler for static export hosting (Vercel / GitHub Pages)
      // Match /groups/:id
      const groupMatch = path.match(/\/groups\/([^/]+)/);
      if (groupMatch && groupMatch[1] !== "default") {
        router.replace(`/groups/default?id=${encodeURIComponent(groupMatch[1])}`);
        return;
      }

      // Match /trips/:id
      const tripMatch = path.match(/\/trips\/([^/]+)/);
      if (tripMatch && tripMatch[1] !== "default" && tripMatch[1] !== "view") {
        router.replace(`/trips/default?id=${encodeURIComponent(tripMatch[1])}`);
        return;
      }

      // Match /routes/:id
      const routeMatch = path.match(/\/routes\/([^/]+)/);
      if (routeMatch && routeMatch[1] !== "default") {
        router.replace(`/routes/default?id=${encodeURIComponent(routeMatch[1])}`);
        return;
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4" />
      <h1 className="text-xl font-bold text-slate-200">Loading TripSync Page...</h1>
      <p className="text-slate-400 text-sm mt-2">Redirecting to your destination...</p>
    </div>
  );
}
