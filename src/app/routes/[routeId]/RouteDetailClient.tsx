"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  MapPin, Route, Navigation2, Compass, 
  ArrowLeft, ExternalLink, Play, Square, 
  Calendar, Navigation
} from "lucide-react";
import { toast } from "react-hot-toast";
import type { MapSpot } from "../../../components/map/LeafletMap";

const LeafletMap = dynamic(
  () => import("../../../components/map/LeafletMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-950 rounded-2xl border border-white/5">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading interactive map…</span>
        </div>
      </div>
    ),
  }
);

const REROUTE_THRESHOLD_KM = 0.15;

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const pointToSegmentDist = (
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number => {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return haversineKm(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return haversineKm(px, py, ax + t * dx, ay + t * dy);
};

const sanitizeRouteId = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://") || trimmed.startsWith("/") || trimmed.includes("routes")) {
      const urlString = trimmed.startsWith("/") ? `https://tripsync.example.com${trimmed}` : trimmed;
      const url = new URL(urlString);
      const qParam = url.searchParams.get("routeId");
      if (qParam && qParam.trim()) return qParam.trim();
      const parts = url.pathname.split("/");
      const routesIdx = parts.indexOf("routes");
      if (routesIdx !== -1 && parts[routesIdx + 1] && parts[routesIdx + 1].trim()) {
        return parts[routesIdx + 1].trim();
      }
      const lastSeg = parts[parts.length - 1];
      if (lastSeg && lastSeg.trim()) return lastSeg.trim();
    }
  } catch (e) {
    console.error("Error parsing routeId:", e);
  }
  return trimmed.split("/").pop() || trimmed;
};

const isValidRouteId = (id: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(id);
};

export default function SharedRoutePage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params?.routeId as string;

  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState<any>(null);
  const [stops, setStops] = useState<MapSpot[]>([]);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  const [navActive, setNavActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navStats, setNavStats] = useState<{ distance: string; duration: string } | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const rawCoordsRef = useRef<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => {
    if (!routeId) return;

    const fetchRoute = async () => {
      const cleanId = sanitizeRouteId(routeId);
      if (!isValidRouteId(cleanId)) {
        toast.error("Invalid route path segment");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "routes", cleanId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRouteData(data);
          
          const loadedStops = (data.stops || data.items || []).map((s: any) => ({
            name: s.name,
            latitude: s.latitude || s.lat,
            longitude: s.longitude || s.lon,
            address: s.address || "",
          }));
          setStops(loadedStops);

          const coords = data.routeCoordinates || data.coords || [];
          setRouteCoords(coords);
          rawCoordsRef.current = coords;
        } else {
          toast.error("Route not found");
        }
      } catch (err) {
        console.error("Error fetching route:", err);
        toast.error("Failed to load route details");
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [routeId]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const fetchOSRMSteps = async (startLat: number, startLon: number, destinations: MapSpot[]) => {
    if (destinations.length === 0) return;
    try {
      const coordsStr = `${startLon},${startLat};` + destinations.map(d => `${d.longitude},${d.latitude}`).join(";");
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=true`
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        const steps: any[] = [];
        route.legs.forEach((leg: any, legIdx: number) => {
          leg.steps.forEach((step: any) => {
            steps.push({
              instruction: step.maneuver.instruction,
              type: step.maneuver.type,
              modifier: step.maneuver.modifier,
              distance: step.distance,
              duration: step.duration,
              legIndex: legIdx,
            });
          });
        });
        
        setNavigationSteps(steps);
        setCurrentStepIndex(0);
        
        const matchedCoords = route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
        setRouteCoords(matchedCoords);
        rawCoordsRef.current = matchedCoords;

        const distanceKm = (route.distance / 1000).toFixed(1);
        const mins = Math.round(route.duration / 60);
        const durationText = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
        setNavStats({ distance: distanceKm, duration: durationText });
      }
    } catch (err) {
      console.error("Error fetching turn-by-turn steps:", err);
    }
  };

  const startNavigation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setNavActive(true);
    toast.success("🧭 Navigation started!");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        setPanTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 15 });
        await fetchOSRMSteps(pos.coords.latitude, pos.coords.longitude, stops);
      },
      (err) => {
        toast.error("Could not obtain GPS lock");
        console.error(err);
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        setPanTo({ lat: pos.coords.latitude, lon: pos.coords.longitude });

        const currentPath = rawCoordsRef.current;
        if (currentPath.length >= 2) {
          let minDistance = Infinity;
          for (let i = 0; i < currentPath.length - 1; i++) {
            const d = pointToSegmentDist(
              pos.coords.latitude, pos.coords.longitude,
              currentPath[i].latitude, currentPath[i].longitude,
              currentPath[i+1].latitude, currentPath[i+1].longitude
            );
            if (d < minDistance) minDistance = d;
          }

          if (minDistance > REROUTE_THRESHOLD_KM) {
            toast("🔄 Off-route detected! Recalculating...");
            await fetchOSRMSteps(pos.coords.latitude, pos.coords.longitude, stops);
          }
        }
      },
      (err) => {
        console.error("Error watching location:", err);
      },
      { enableHighAccuracy: true }
    ) as unknown as number;
  };

  const stopNavigation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setNavActive(false);
    setUserLocation(null);
    setNavigationSteps([]);
    setNavStats(null);
    
    if (routeData) {
      setRouteCoords(routeData.routeCoordinates || routeData.coords || []);
      rawCoordsRef.current = routeData.routeCoordinates || routeData.coords || [];
    }
    toast("🧭 Navigation stopped");
  };

  const openInApp = () => {
    const deepLink = `tripsync://map?routeId=${routeId}`;
    window.location.href = deepLink;
    setTimeout(() => {
      toast("Opening in App... Make sure TripSync is installed on your device.", { icon: "ℹ️" });
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400">
        <Compass className="h-12 w-12 text-teal-400 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide">Fetching shared route details...</p>
      </div>
    );
  }

  if (!routeData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-center p-6">
        <MapPin className="h-16 w-16 text-rose-500 mb-4" />
        <h1 className="text-white text-2xl font-bold mb-2">Shared Route Not Found</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          The link might be broken or the route was deleted by its creator.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="bg-teal-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm transition hover:opacity-90"
        >
          Go to TripSync Web
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-white/5 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.back()} 
              className="p-2 rounded-xl bg-slate-950 border border-white/10 text-slate-400 hover:text-white transition"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Route className="h-4.5 w-4.5 text-teal-400" />
                <span>Shared TripSync Route</span>
              </h1>
              <p className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider">Public Viewer</p>
            </div>
          </div>
          
          <button
            onClick={openInApp}
            className="flex items-center gap-1.5 bg-teal-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition shadow-lg shadow-teal-500/15"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open in Mobile App</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        <div className="lg:col-span-1 flex flex-col space-y-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <div>
              <span className="text-[10px] font-extrabold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                {routeData.tripId ? "Trip Day Linked" : "Custom Itinerary"}
              </span>
              <h2 className="text-xl font-extrabold text-white mt-2 leading-tight">{routeData.routeName || routeData.name}</h2>
              <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                <span className="truncate">Start: {routeData.startLocation || "Current Location"}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-white/5 py-3 text-center">
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Stops</p>
                <p className="text-white text-base font-extrabold mt-0.5">{stops.length}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Distance</p>
                <p className="text-teal-400 text-base font-extrabold mt-0.5">{navStats ? navStats.distance : (routeData.totalDistance || "N/A")} km</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Duration</p>
                <p className="text-white text-base font-extrabold mt-0.5">{navStats ? navStats.duration : (routeData.totalDuration || "N/A")}</p>
              </div>
            </div>

            <div className="pt-1">
              {navActive ? (
                <button
                  onClick={stopNavigation}
                  className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-3 rounded-xl text-sm font-bold hover:bg-rose-500/20 transition active:scale-95 shadow-md shadow-rose-500/5"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>Stop Navigation</span>
                </button>
              ) : (
                <button
                  onClick={startNavigation}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 py-3 rounded-xl text-sm font-extrabold transition hover:opacity-90 active:scale-95 shadow-lg shadow-teal-500/10"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Live Navigation</span>
                </button>
              )}
            </div>
          </div>

          {navActive && navigationSteps.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 space-y-4 bg-teal-950/10 animate-fade-in">
              <h3 className="text-teal-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="h-4 w-4" />
                <span>Guidance Instructions</span>
              </h3>
              
              <div className="bg-slate-900 border border-white/10 rounded-xl p-4 flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Navigation2 className="h-5 w-5 text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold leading-snug">
                    {navigationSteps[currentStepIndex]?.instruction || "Drive carefully"}
                  </p>
                  {navigationSteps[currentStepIndex] && (
                    <p className="text-slate-400 text-xs mt-1">
                      In {Math.round(navigationSteps[currentStepIndex].distance)} meters
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                  <span>Navigation Progress</span>
                  <span>{currentStepIndex + 1} / {navigationSteps.length} Steps</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStepIndex + 1) / navigationSteps.length) * 100}%` }}
                  />
                </div>
              </div>

              {navigationSteps.length > currentStepIndex + 1 && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Upcoming turns:</span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {navigationSteps.slice(currentStepIndex + 1, currentStepIndex + 5).map((step, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-white/5">
                        <span className="truncate pr-3">{step.instruction}</span>
                        <span className="text-teal-400 font-semibold font-mono shrink-0">{Math.round(step.distance)}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-teal-400" />
              <span>Itinerary Stops sequence</span>
            </h3>

            <div className="space-y-3 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/5">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex gap-4 relative group">
                  <div className="w-6.5 h-6.5 rounded-full bg-slate-900 border border-white/10 text-slate-300 font-extrabold text-[11px] flex items-center justify-center shrink-0 z-10 group-hover:border-teal-400 group-hover:text-teal-400 transition">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 bg-slate-900/40 border border-white/5 p-3 rounded-xl flex-1 group-hover:bg-white/3 transition">
                    <p className="text-white text-xs font-bold truncate">{stop.name}</p>
                    {stop.address && (
                      <p className="text-slate-500 text-[10px] truncate mt-1">{stop.address}</p>
                    )}
                  </div>
                </div>
              ))}
              {stops.length === 0 && (
                <p className="text-slate-550 text-xs italic text-center py-4">No stops in this route itinerary.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 overflow-hidden relative" style={{ height: "calc(100vh - 120px)", minHeight: "450px" }}>
          <LeafletMap 
            spots={stops}
            routeCoords={routeCoords}
            routePolylineStyle={navActive ? "solid" : "dashed"}
            userLocation={userLocation}
            panTo={panTo}
            height="100%"
          />
          
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${navActive ? "bg-emerald-400 animate-pulse" : "bg-teal-400"}`} />
            <span className="text-white text-xs font-semibold">
              {navActive ? "Live Guidance Active" : "Route Preview"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
