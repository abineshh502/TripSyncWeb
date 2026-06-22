"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  MapPin, Route, Calendar, Clock, Users, Navigation2,
  Loader2, AlertTriangle, Globe, Share2, Copy, Check,
  ChevronRight, Map, Home, ArrowLeft, Info
} from "lucide-react";
import { toast } from "react-hot-toast";
import { buildTripShareUrl, validateShareUrl } from "../../../lib/shareUtils";
import type { MapSpot } from "../../../components/map/LeafletMap";

// SSR-safe map
const LeafletMap = dynamic(
  () => import("../../../components/map/LeafletMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 rounded-2xl">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading map…</span>
        </div>
      </div>
    ),
  }
);

// ── Helper ────────────────────────────────────────────────────────────────────
function formatDate(raw: string | undefined): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return raw; }
}

function tripDays(start: string | undefined, end: string | undefined): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
}

// ── Error States ───────────────────────────────────────────────────────────
function ErrorCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="glass-panel max-w-md w-full rounded-2xl border border-rose-500/20 p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
          {icon}
        </div>
        <h2 className="text-white font-bold text-xl">{title}</h2>
        <p className="text-slate-400 text-sm">{message}</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 mt-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition"
        >
          <Home className="h-4 w-4" /> Go Home
        </a>
      </div>
    </div>
  );
}

// ── Main Content (needs Suspense for useSearchParams) ──────────────────────
function TripViewContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("id") || searchParams.get("trip") || ""; // support both ?id= and ?trip=

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "invalid_id" | "fetch_error" | null>(null);
  const [tripData, setTripData] = useState<any>(null);
  const [spots, setSpots] = useState<MapSpot[]>([]);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [copied, setCopied] = useState(false);

  // ── Validate ID ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId || !tripId.trim()) {
      setError("invalid_id");
      setLoading(false);
      return;
    }

    const cleanId = tripId.trim();
    // Firestore IDs are alphanumeric with dashes
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      setError("invalid_id");
      setLoading(false);
      return;
    }

    const fetchTrip = async () => {
      try {
        const docRef = doc(db, "trips", cleanId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setError("not_found");
          setLoading(false);
          return;
        }

        const data = snap.data();
        setTripData({ id: snap.id, ...data });

        // Build map spots from trip.spots or trip.days destinations
        const rawSpots: MapSpot[] = [];
        if (data.spots && Array.isArray(data.spots)) {
          data.spots.forEach((s: any) => {
            if (s.latitude && s.longitude) {
              rawSpots.push({ name: s.name, latitude: s.latitude, longitude: s.longitude, address: s.address || "" });
            }
          });
        } else if (data.days && Array.isArray(data.days)) {
          data.days.forEach((day: any) => {
            if (Array.isArray(day.destinations)) {
              day.destinations.forEach((d: any) => {
                const lat = d.lat || d.latitude;
                const lon = d.lon || d.longitude;
                if (lat && lon) {
                  rawSpots.push({ name: d.name, latitude: lat, longitude: lon, address: d.address || "" });
                }
              });
            }
          });
        }
        setSpots(rawSpots);

        // Try to load route if mapLink exists
        if (rawSpots.length >= 2) {
          try {
            const coordsStr = rawSpots.map(s => `${s.longitude},${s.latitude}`).join(";");
            const res = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
            );
            const osrm = await res.json();
            if (osrm.routes?.[0]) {
              setRouteCoords(osrm.routes[0].geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] })));
            }
          } catch {
            // Route line is optional — don't fail
          }
        }
      } catch (err) {
        console.error("Error fetching trip:", err);
        setError("fetch_error");
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [tripId]);

  // ── Share helpers ──────────────────────────────────────────────────────────
  const shareUrl = tripId ? buildTripShareUrl(tripId) : "";
  const isValidUrl = shareUrl ? validateShareUrl(shareUrl) : false;

  const copyLink = () => {
    if (!isValidUrl) { toast.error("Invalid share link"); return; }
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("📋 Link copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsAppShare = () => {
    if (!tripData || !isValidUrl) return;
    const text = `Check out this trip "${tripData.name || tripData.tripName}" to ${tripData.destination} on TripSync! 🌍\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
          <p className="text-sm">Loading trip details…</p>
        </div>
      </div>
    );
  }

  // ── Error States ───────────────────────────────────────────────────────────
  if (error === "invalid_id" || !tripId) {
    return (
      <ErrorCard
        icon={<AlertTriangle className="h-8 w-8 text-rose-400" />}
        title="Invalid Trip ID"
        message="The trip ID in this link is missing or malformed. Please ask the sender to regenerate the share link."
      />
    );
  }
  if (error === "not_found") {
    return (
      <ErrorCard
        icon={<Info className="h-8 w-8 text-amber-400" />}
        title="Trip Not Found"
        message={`No trip was found with ID "${tripId}". The link may be expired or the trip was deleted.`}
      />
    );
  }
  if (error === "fetch_error") {
    return (
      <ErrorCard
        icon={<AlertTriangle className="h-8 w-8 text-rose-400" />}
        title="Could Not Load Trip"
        message="There was an error loading this trip. Please check your internet connection and try again."
      />
    );
  }

  const name = tripData?.name || tripData?.tripName || "Trip";
  const destination = tripData?.destination || "Unknown";
  const days = tripDays(tripData?.startDate, tripData?.endDate);
  const members = tripData?.userIds?.length || 1;
  const memberNames: Record<string, string> = tripData?.memberNames || {};
  const itineraryDays: any[] = tripData?.days || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </a>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-400" />
              <span className="text-white font-bold text-sm truncate max-w-[200px]">{name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 bg-slate-800 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition active:scale-95"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={whatsAppShare}
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition active:scale-95"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* ── Hero Card ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-950 p-8">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400 border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 rounded-full">
                TripSync · Shared Trip
              </span>
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight leading-none">{name}</h1>
            <p className="text-slate-400 flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-teal-400" />
              {destination}
            </p>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 pt-2">
              {tripData?.startDate && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Calendar className="h-4 w-4 text-teal-400" />
                  {formatDate(tripData.startDate)} → {formatDate(tripData.endDate)}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Clock className="h-4 w-4 text-emerald-400" />
                {days} day{days !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Users className="h-4 w-4 text-violet-400" />
                {members} traveller{members !== 1 ? "s" : ""}
              </div>
              {spots.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Route className="h-4 w-4 text-amber-400" />
                  {spots.length} stop{spots.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {tripData?.description && (
              <p className="text-slate-400 text-sm max-w-xl border-t border-white/5 pt-4">{tripData.description}</p>
            )}
          </div>
        </div>

        {/* ── Map + Stops ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div
            className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 overflow-hidden"
            style={{ height: "420px" }}
          >
            {spots.length > 0 ? (
              <LeafletMap
                spots={spots}
                routeCoords={routeCoords}
                routePolylineStyle="solid"
                height="100%"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <Map className="h-10 w-10" />
                <p className="text-sm">No map stops in this trip yet</p>
              </div>
            )}
          </div>

          {/* Stops sidebar */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Route className="h-4 w-4 text-teal-400" />
                Stops & Destinations
              </h3>
            </div>
            {spots.length > 0 ? (
              <div className="divide-y divide-white/5 max-h-[340px] overflow-y-auto">
                {spots.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-white/3 transition">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-slate-950 text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{s.name}</p>
                      {s.address && <p className="text-slate-500 text-xs truncate mt-0.5">{s.address}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
                <MapPin className="h-8 w-8" />
                <p className="text-sm">No stops yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Day-by-Day Itinerary ── */}
        {itineraryDays.length > 0 && (
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-400" />
                Day-by-Day Itinerary
              </h3>
            </div>
            <div className="divide-y divide-white/5">
              {itineraryDays.map((day: any, idx: number) => (
                <div key={idx} className="px-6 py-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/25 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">
                      D{day.dayNumber || idx + 1}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        Day {day.dayNumber || idx + 1}
                        {day.theme ? ` — ${day.theme}` : ""}
                      </p>
                      {day.date && <p className="text-slate-500 text-xs">{formatDate(day.date)}</p>}
                    </div>
                    {day.mapLink && (
                      <a
                        href={day.mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1.5 text-teal-400 text-xs border border-teal-500/20 px-2.5 py-1 rounded-lg hover:bg-teal-500/10 transition"
                      >
                        <Navigation2 className="h-3 w-3" />
                        Navigate
                      </a>
                    )}
                  </div>

                  {/* Activities */}
                  {day.activities && Array.isArray(day.activities) && day.activities.length > 0 && (
                    <div className="ml-11 space-y-1.5">
                      {day.activities.map((act: any, ai: number) => (
                        <div key={ai} className="flex items-start gap-2 text-slate-400 text-xs">
                          <ChevronRight className="h-3.5 w-3.5 text-teal-500 shrink-0 mt-0.5" />
                          <span>{typeof act === "string" ? act : act.name || act.description || JSON.stringify(act)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Destinations */}
                  {day.destinations && Array.isArray(day.destinations) && day.destinations.length > 0 && (
                    <div className="ml-11 flex flex-wrap gap-1.5">
                      {day.destinations.map((d: any, di: number) => (
                        <span
                          key={di}
                          className="flex items-center gap-1 bg-slate-800/60 border border-white/5 text-slate-300 text-xs px-2.5 py-1 rounded-full"
                        >
                          <MapPin className="h-2.5 w-2.5 text-teal-400" />
                          {d.name || d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Members ── */}
        {Object.keys(memberNames).length > 0 && (
          <div className="glass-panel rounded-2xl border border-white/5 p-6">
            <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-violet-400" />
              Trip Members
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(memberNames).map(([uid, displayName]) => (
                <div
                  key={uid}
                  className="flex items-center gap-2 bg-slate-800/60 border border-white/5 px-3 py-1.5 rounded-xl"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-teal-500 text-slate-950 text-[9px] font-bold flex items-center justify-center">
                    {(displayName as string)[0]?.toUpperCase()}
                  </div>
                  <span className="text-white text-xs font-medium">{displayName as string}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Share strip ── */}
        <div className="glass-panel rounded-2xl border border-teal-500/15 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4 text-teal-400" />
              Share this trip
            </p>
            <p className="text-slate-500 text-xs mt-0.5 font-mono break-all">{isValidUrl ? shareUrl : "—"}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-500/20 transition active:scale-95"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={whatsAppShare}
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition active:scale-95"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wrapped in Suspense for useSearchParams ────────────────────────────────
export default function TripViewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
      </div>
    }>
      <TripViewContent />
    </Suspense>
  );
}
