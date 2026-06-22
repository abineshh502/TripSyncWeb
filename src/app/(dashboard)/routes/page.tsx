"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { useTrips } from "../../../hooks/useTrips";
import { db } from "../../../lib/firebase";
import { travelApiService } from "../../../services/api";
import { sanitizeInput } from "../../../lib/utils";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  or,
} from "firebase/firestore";
import {
  Search, MapPin, Navigation2, Route, Share2, Plus, Trash2,
  Heart, Crosshair, Loader2, X, ChevronUp, ChevronDown,
  Globe, Shuffle, Copy, Check, Home, Compass,
  ArrowRight, Info, Map, Flag, Play, Square, Volume2, VolumeX,
} from "lucide-react";
import { toast } from "react-hot-toast";
import type { POIMarker, MapSpot } from "../../../components/map/LeafletMap";

// ── Dynamic map import (SSR-safe) ──────────────────────────────────────────
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

// ── Constants ──────────────────────────────────────────────────────────────
const GEOAPIFY_KEY = "303db9c9ea7b411f81e4aaa234c881e5";
const REROUTE_THRESHOLD_KM = 0.15;

type Mode = "explore" | "directions" | "builder";

interface Suggestion {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distLabel?: string;
}

interface RouteStats { distance: string; duration: string; }

// ── Route URL parsing & validation helpers ────────────────────────────────
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

const cleanRouteUrl = (origin: string, routeId: string): string => {
  const cleanedOrigin = origin.replace(/\/+$/, "");
  const url = `${cleanedOrigin}/routes/${routeId}`;
  return url.replace(/([^:]\/)\/+/g, "$1");
};

// ── Haversine distance ─────────────────────────────────────────────────────
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

const formatDuration = (seconds: number) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
};

// ── POI category config ────────────────────────────────────────────────────
const POI_CATEGORIES = [
  { label: "📍 All", id: "all" },
  { label: "🏛 Sights", id: "sights" },
  { label: "🍽 Food", id: "cafes" },
  { label: "🏨 Hotels", id: "hotels" },
];

// ── Inner content (uses useSearchParams — must be wrapped in Suspense) ─────
function MapPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // ── Mode ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("explore");

  // ── User GPS ────────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);

  // ── Search / Suggestions shared ─────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const suggDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Explore mode ────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [favPlaces, setFavPlaces] = useState<any[]>([]);
  const [visitedPlaces, setVisitedPlaces] = useState<any[]>([]);
  const [poiFilter, setPoiFilter] = useState("all");
  const [selectedPlace, setSelectedPlace] = useState<POIMarker | null>(null);
  const [loadingPOI, setLoadingPOI] = useState(false);

  // ── Directions mode ──────────────────────────────────────────────────────
  const [startText, setStartText] = useState("");
  const [destText, setDestText] = useState("");
  const [startPlace, setStartPlace] = useState<MapSpot | null>(null);
  const [destPlace, setDestPlace] = useState<MapSpot | null>(null);
  const [directionsRouteCoords, setDirectionsRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [directionsStats, setDirectionsStats] = useState<RouteStats | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [navProgress, setNavProgress] = useState(0);
  const [navActive, setNavActive] = useState(false);
  const navIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Route Builder mode ───────────────────────────────────────────────────
  const [builderStartText, setBuilderStartText] = useState("");
  const [builderStartPlace, setBuilderStartPlace] = useState<MapSpot | null>(null);
  const [builderAddText, setBuilderAddText] = useState("");
  const [stops, setStops] = useState<MapSpot[]>([]);
  const [builderRouteCoords, setBuilderRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [builderStats, setBuilderStats] = useState<RouteStats | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteName, setEditingRouteName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareRouteId, setShareRouteId] = useState<string | null>(null);
  const [shareRouteName, setShareRouteName] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [builderLoading, setBuilderLoading] = useState(false);
  const { trips: userTrips } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);

  // ── Builder Active Navigation States & Refs ──────────────────────────────
  const [builderNavActive, setBuilderNavActive] = useState(false);
  const [builderNavPaused, setBuilderNavPaused] = useState(false);
  const [builderCurrentStopIndex, setBuilderCurrentStopIndex] = useState(0);
  const [builderNavRouteCoords, setBuilderNavRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [builderNavStats, setBuilderNavStats] = useState<{ distance: string; duration: string; eta: string; currentSpeed: number } | null>(null);
  const [builderNavSteps, setBuilderNavSteps] = useState<any[]>([]);
  const [builderCurrentStepIndex, setBuilderCurrentStepIndex] = useState(0);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [visitedStops, setVisitedStops] = useState<string[]>([]);
  const [totalDistanceTraveled, setTotalDistanceTraveled] = useState<number>(0);
  const [navStartTime, setNavStartTime] = useState<Date | null>(null);

  const builderWatchIdRef = useRef<number | null>(null);
  const lastSpokenRef = useRef<string>("");
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);


  // ── Deep-link route loading ───────────────────────────────────────────────
  const loadedRouteIdRef = useRef<string | null>(null);

  // ── Firebase: subscribe to favorites + visited ───────────────────────────
  useEffect(() => {
    if (!user) return;
    const qFav = query(collection(db, "favorites"), where("userId", "==", user.uid));
    const unsubFav = onSnapshot(qFav, (snap) => {
      setFavPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const qVis = query(collection(db, "visited"), where("userId", "==", user.uid));
    const unsubVis = onSnapshot(qVis, (snap) => {
      setVisitedPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubFav(); unsubVis(); };
  }, [user]);


  // ── Load route from URL param on mount ───────────────────────────────────
  useEffect(() => {
    const rid = searchParams.get("routeId");
    if (rid) {
      const cleanId = sanitizeRouteId(rid);
      if (isValidRouteId(cleanId) && cleanId !== loadedRouteIdRef.current) {
        loadRouteById(cleanId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Boot: grab GPS silently ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        fetchPOIMarkers(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // fallback to Chennai
        fetchPOIMarkers(13.0827, 80.2707);
      }
    );
  }, []);

  // ── Locate me button ─────────────────────────────────────────────────────
  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        setPanTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 14 });
        fetchPOIMarkers(pos.coords.latitude, pos.coords.longitude);
        toast.success("📍 Location found!");
      },
      () => toast.error("Could not get your location. Enable GPS permissions.")
    );
  };

  // ── Fetch POI markers from Geoapify ─────────────────────────────────────
  const fetchPOIMarkers = async (lat: number, lon: number) => {
    setLoadingPOI(true);
    try {
      const cats = [
        "tourism.sights", "catering.cafe", "catering.restaurant", "catering.fast_food",
        "accommodation.hotel", "healthcare.hospital", "healthcare.pharmacy",
        "commercial.supermarket", "commercial.shopping_mall", "religion",
        "leisure.park", "entertainment.museum", "public_transport",
        "education.school",
      ].join(",");

      const res = await fetch(
        `https://api.geoapify.com/v2/places?categories=${cats}&bias=proximity:${lon},${lat}&limit=100&apiKey=${GEOAPIFY_KEY}`
      );
      const data = await res.json();
      if (!data.features) return;

      const mapped: POIMarker[] = data.features
        .filter((f: any) => f.properties.lat && f.properties.lon)
        .map((f: any) => {
          const name = f.properties.name || f.properties.street || "Spot";
          const cat: string[] = f.properties.categories || [];
          let type = "sight", pinColor = "#EAB308";
          if (cat.some((c) => c.includes("restaurant") || c.includes("fast_food"))) { type = "restaurant"; pinColor = "#F97316"; }
          else if (cat.some((c) => c.includes("cafe"))) { type = "cafe"; pinColor = "#06B6D4"; }
          else if (cat.some((c) => c.includes("accommodation") || c.includes("hotel"))) { type = "hotel"; pinColor = "#EC4899"; }
          else if (cat.some((c) => c.includes("hospital") || c.includes("pharmacy"))) { type = "medical"; pinColor = "#EF4444"; }
          else if (cat.some((c) => c.includes("supermarket") || c.includes("shopping"))) { type = "shop"; pinColor = "#8B5CF6"; }
          else if (cat.some((c) => c.includes("park") || c.includes("leisure"))) { type = "park"; pinColor = "#10B981"; }
          else if (cat.some((c) => c.includes("religion"))) { type = "temple"; pinColor = "#FBBF24"; }
          else if (cat.some((c) => c.includes("museum") || c.includes("entertainment"))) { type = "museum"; pinColor = "#A78BFA"; }
          else if (cat.some((c) => c.includes("transport"))) { type = "transport"; pinColor = "#64748B"; }
          else if (cat.some((c) => c.includes("education"))) { type = "school"; pinColor = "#0EA5E9"; }
          return {
            name,
            type,
            pinColor,
            rating: (4.1 + (name.length % 9) * 0.1).toFixed(1),
            address: f.properties.formatted || "Nearby",
            latitude: f.properties.lat,
            longitude: f.properties.lon,
          };
        });
      setPoiMarkers(mapped);
    } catch (e) {
      console.error("POI fetch error:", e);
    } finally {
      setLoadingPOI(false);
    }
  };

  // ── Autocomplete fetch ────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (text: string) => {
    const cleanText = sanitizeInput(text);
    if (!cleanText || cleanText.length < 2) { setSuggestions([]); return; }
    const biasParam = userLocation
      ? `&bias=proximity:${userLocation.longitude},${userLocation.latitude}` : "";
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(cleanText)}&limit=8${biasParam}&apiKey=${GEOAPIFY_KEY}`
      );
      const data = await res.json();
      if (!data.features) return;
      const items: Suggestion[] = data.features
        .filter((f: any) => f.properties.lat && f.properties.lon)
        .map((f: any) => ({
          name: f.properties.name || f.properties.formatted?.split(",")[0] || "Place",
          address: f.properties.formatted || "",
          latitude: f.properties.lat,
          longitude: f.properties.lon,
        }));
      if (userLocation) {
        items.forEach((item) => {
          const d = haversineKm(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude);
          item.distLabel = d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
        });
        items.sort((a, b) =>
          haversineKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) -
          haversineKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
        );
      }
      setSuggestions(items);
    } catch {}
  }, [userLocation]);

  const debouncedSuggest = (text: string) => {
    if (suggDebounce.current) clearTimeout(suggDebounce.current);
    suggDebounce.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  // ── Select suggestion handler ─────────────────────────────────────────────
  const handleSelectSuggestion = async (item: Suggestion) => {
    setSuggestions([]);
    setActiveInput(null);

    if (activeInput === "explore") {
      setSearchText(item.name);
      await fetchPOIMarkers(item.latitude, item.longitude);
      setPanTo({ lat: item.latitude, lon: item.longitude, zoom: 13 });
      setSelectedPlace({ name: item.name, type: "sight", rating: "4.8", address: item.address, latitude: item.latitude, longitude: item.longitude, pinColor: "#38BDF8" });
    } else if (activeInput === "dir_start") {
      setStartPlace(item);
      setStartText(item.name);
    } else if (activeInput === "dir_dest") {
      setDestPlace(item);
      setDestText(item.name);
    } else if (activeInput === "builder_start") {
      const spot: MapSpot = { name: item.name, latitude: item.latitude, longitude: item.longitude, address: item.address };
      setBuilderStartPlace(spot);
      setBuilderStartText(item.name);
      await updateBuilderPolyline(stops, spot);
    } else if (activeInput === "builder_add") {
      setBuilderAddText("");
      await addBuilderStop(item);
    }
  };

  // ── DIRECTIONS: Calculate route ───────────────────────────────────────────
  const calculateDirections = async () => {
    if (!startPlace || !destPlace) { toast.error("Set start and destination first"); return; }
    setCalcLoading(true);
    setDirectionsRouteCoords([]);
    setDirectionsStats(null);
    stopNavigation();
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startPlace.longitude},${startPlace.latitude};${destPlace.longitude},${destPlace.latitude}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
        setDirectionsRouteCoords(coords);
        setDirectionsStats({ distance: (route.distance / 1000).toFixed(1), duration: formatDuration(route.duration) });
      } else {
        toast.error("No route found between these locations");
      }
    } catch {
      toast.error("Could not calculate route. Check your connection.");
    } finally {
      setCalcLoading(false);
    }
  };

  // ── DIRECTIONS: Navigation simulation ────────────────────────────────────
  const startNavigation = () => {
    if (directionsRouteCoords.length < 2) return;
    setNavActive(true);
    setNavProgress(0);
    toast.success("🧭 Navigation started!");
    navIntervalRef.current = setInterval(() => {
      setNavProgress((p) => {
        if (p >= 1) {
          stopNavigation();
          toast.success("🎉 Arrived at destination!");
          return 1;
        }
        return Math.min(1, p + 0.005);
      });
    }, 500);
  };

  const stopNavigation = () => {
    if (navIntervalRef.current) { clearInterval(navIntervalRef.current); navIntervalRef.current = null; }
    setNavActive(false);
    setNavProgress(0);
  };

  // ── BUILDER: Update polyline ──────────────────────────────────────────────
  const updateBuilderPolyline = async (currentStops: MapSpot[], customStart?: MapSpot | null) => {
    const start = customStart !== undefined ? customStart : builderStartPlace;
    const all: MapSpot[] = [...(start ? [start] : []), ...currentStops];
    if (all.length < 2) { setBuilderRouteCoords([]); setBuilderStats(null); return; }
    try {
      const coordsStr = all.map((s) => `${s.longitude},${s.latitude}`).join(";");
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.length > 0) {
        const route = data.routes[0];
        setBuilderRouteCoords(route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] })));
        setBuilderStats({ distance: (route.distance / 1000).toFixed(1), duration: formatDuration(route.duration) });
      }
    } catch {
      setBuilderRouteCoords(all.map((s) => ({ latitude: s.latitude, longitude: s.longitude })));
      setBuilderStats({ distance: "N/A", duration: "N/A" });
    }
  };

  // ── BUILDER: Add stop ─────────────────────────────────────────────────────
  const addBuilderStop = async (item: Suggestion) => {
    if (stops.some((s) => s.name === item.name)) { toast.error("Stop already added"); return; }
    const spot: MapSpot = { name: item.name, latitude: item.latitude, longitude: item.longitude, address: item.address };
    const updated = [...stops, spot];
    setStops(updated);
    await updateBuilderPolyline(updated);
    toast.success(`📍 Added: ${item.name}`);
  };

  // ── BUILDER: Remove stop ──────────────────────────────────────────────────
  const removeStop = async (idx: number) => {
    const updated = stops.filter((_, i) => i !== idx);
    setStops(updated);
    await updateBuilderPolyline(updated);
  };

  // ── BUILDER: Reorder stop ─────────────────────────────────────────────────
  const moveStop = async (idx: number, dir: "up" | "down") => {
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === stops.length - 1) return;
    const updated = [...stops];
    const tgt = dir === "up" ? idx - 1 : idx + 1;
    [updated[idx], updated[tgt]] = [updated[tgt], updated[idx]];
    setStops(updated);
    await updateBuilderPolyline(updated);
  };

  // ── BUILDER: Optimize ─────────────────────────────────────────────────────
  const optimizeRoute = async () => {
    if (stops.length <= 2) { toast.error("Add at least 3 stops to optimize"); return; }
    setOptimizing(true);
    try {
      const optimized = await travelApiService.optimizeTravelRoute(
        stops.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude }))
      );
      const reordered = optimized.map((o) => stops.find((s) => s.name === o.name) || o as MapSpot);
      setStops(reordered);
      await updateBuilderPolyline(reordered);
      toast.success("✨ Route optimized!");
    } catch {
      toast.error("Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const updateTripDayRoute = async (tripId: string, dayNum: number, routeId: string, webLink: string, stopsList: any[]) => {
    try {
      const tripRef = doc(db, "trips", tripId);
      const tripSnap = await getDoc(tripRef);
      if (tripSnap.exists()) {
        const tripData = tripSnap.data();
        const days = tripData.days || [];
        const updatedDays = days.map((day: any) => {
          if (day.dayNumber === dayNum) {
            return {
              ...day,
              mapLink: webLink,
              destinations: stopsList.map(stop => ({
                name: stop.name,
                lat: stop.latitude || stop.lat,
                lon: stop.longitude || stop.lon,
              })),
            };
          }
          return day;
        });
        await updateDoc(tripRef, { days: updatedDays });
      }
    } catch (err) {
      console.error("Error updating trip day route:", err);
    }
  };

  // ── BUILDER: Save to Firebase ─────────────────────────────────────────────
  const saveRoute = async (nameOverride?: string): Promise<string | null> => {
    if (!user) { toast.error("Please log in to save routes"); return null; }
    if (stops.length < 1) { toast.error("Add at least 1 stop"); return null; }

    const selectedTrip = userTrips.find(t => t.id === selectedTripId);
    const defaultName = selectedTrip 
      ? `Day ${selectedDayNumber} Map` 
      : (nameOverride || editingRouteName || "My Route");

    let routeName = defaultName;
    if (!selectedTrip) {
      const name = nameOverride || editingRouteName || prompt("Enter a route name:") || "My Route";
      if (!name || !name.trim()) { toast.error("Route name is required"); return null; }
      routeName = name.trim();
    }

    setSaving(true);
    const routeData = {
      userId: user.uid,
      createdBy: user.uid,
      name: routeName,
      routeName: routeName,
      tripId: selectedTripId || null,
      dayNumber: selectedDayNumber || null,
      startLocation: builderStartText || "Custom Start",
      startCoordinates: builderStartPlace ? { latitude: builderStartPlace.latitude, longitude: builderStartPlace.longitude } : null,
      stops: stops.map((s) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude, address: s.address || "" })),
      items: stops,
      routeCoordinates: builderRouteCoords,
      coords: builderRouteCoords,
      totalDistance: builderStats?.distance || "N/A",
      totalDuration: builderStats?.duration || "N/A",
      updatedAt: new Date(),
    };

    try {
      let rid = editingRouteId;
      if (editingRouteId) {
        await updateDoc(doc(db, "routes", editingRouteId), routeData);
        setEditingRouteName(routeName);
        toast.success(`✅ Route "${routeName}" updated!`);
      } else {
        const ref = await addDoc(collection(db, "routes"), { ...routeData, createdAt: new Date() });
        await updateDoc(ref, { routeId: ref.id });
        rid = ref.id;
        setEditingRouteId(ref.id);
        setEditingRouteName(routeName);
        toast.success(`🌟 Route "${routeName}" saved!`);
      }

      if (selectedTripId && rid) {
        const webLink = cleanRouteUrl(window.location.origin, rid);
        await updateTripDayRoute(selectedTripId, selectedDayNumber, rid, webLink, stops);
      }
      return rid;
    } catch (e) {
      console.error(e);
      toast.error("Could not save route");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── BUILDER: Save & Share ─────────────────────────────────────────────────
  const saveAndShare = async () => {
    if (!user) { toast.error("Please log in"); return; }
    if (stops.length < 1) { toast.error("Add at least 1 stop to share"); return; }

    const selectedTrip = userTrips.find(t => t.id === selectedTripId);
    const defaultName = selectedTrip 
      ? `Day ${selectedDayNumber} Map` 
      : (editingRouteName || "My Route");

    let routeName = defaultName;
    if (!selectedTrip) {
      const name = prompt("Name this route:") || "My Route";
      if (!name || !name.trim()) return;
      routeName = name.trim();
    }

    setSaving(true);
    try {
      const rid = await saveRoute(routeName);
      if (!rid) return;

      const webLink = cleanRouteUrl(window.location.origin, rid);
      const shareDoc = await addDoc(collection(db, "routeShares"), {
        routeId: rid, routeName, createdBy: user.uid,
        sharedAt: new Date(), shareUrl: webLink,
      });
      await updateDoc(shareDoc, { shareId: shareDoc.id });
      await updateDoc(doc(db, "routes", rid), { shareUrl: webLink, sharedAt: new Date() });

      // Log to FastAPI analytics (non-blocking)
      try {
        await travelApiService.shareRoute({
          routeId: rid, routeName, stopsCount: stops.length,
          totalDistance: builderStats?.distance || "N/A",
          totalDuration: builderStats?.duration || "N/A",
        });
      } catch {}

      setShareRouteId(rid);
      setShareRouteName(routeName);
      setShareModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // ── BUILDER: Copy link helper ─────────────────────────────────────────────
  const copyShareLink = () => {
    if (!shareRouteId) return;
    const link = cleanRouteUrl(window.location.origin, shareRouteId);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("📋 Link copied!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // ── BUILDER: New route ────────────────────────────────────────────────────
  const newRoute = () => {
    setStops([]);
    setBuilderRouteCoords([]);
    setBuilderStats(null);
    setBuilderStartPlace(null);
    setBuilderStartText("");
    setBuilderAddText("");
    setEditingRouteId(null);
    setEditingRouteName(null);
    setSelectedTripId("");
    setSelectedDayNumber(1);
    loadedRouteIdRef.current = null;
    toast("🗺️ New route started");
  };

  // ── BUILDER: Load route from Firestore ────────────────────────────────────
  const loadRouteById = async (routeId: string) => {
    const cleanId = sanitizeRouteId(routeId);
    if (!isValidRouteId(cleanId)) {
      toast.error("Invalid route ID format");
      return;
    }
    if (cleanId === loadedRouteIdRef.current) return;
    setBuilderLoading(true);
    loadedRouteIdRef.current = cleanId;
    try {
      const snap = await getDoc(doc(db, "routes", cleanId));
      if (!snap.exists()) { toast.error("Route not found"); return; }
      const data = snap.data();
      const loadedStops: MapSpot[] = (data.stops || data.items || []).map((s: any) => ({
        name: s.name, latitude: s.latitude || s.lat, longitude: s.longitude || s.lon, address: s.address || "",
      }));
      setStops(loadedStops);
      setEditingRouteId(routeId);
      setEditingRouteName(data.routeName || data.name || "Route");
      if (data.startLocation) setBuilderStartText(data.startLocation);
      if (data.startCoordinates) {
        const sp: MapSpot = { name: data.startLocation, latitude: data.startCoordinates.latitude, longitude: data.startCoordinates.longitude };
        setBuilderStartPlace(sp);
      }
      const coords = data.routeCoordinates || data.coords;
      if (coords) setBuilderRouteCoords(coords);
      if (data.totalDistance && data.totalDuration) {
        setBuilderStats({ distance: data.totalDistance, duration: data.totalDuration });
      }
      if (loadedStops[0]) {
        setPanTo({ lat: loadedStops[0].latitude, lon: loadedStops[0].longitude, zoom: 12 });
      }
      setMode("builder");
      setSelectedTripId(data.tripId || "");
      setSelectedDayNumber(data.dayNumber || 1);
      toast.success(`🗺️ Loaded: "${data.routeName || data.name}"`);
    } catch (e) {
      console.error(e);
      toast.error("Could not load route");
    } finally {
      setBuilderLoading(false);
    }
  };

  // ── Active Navigation Core Engine Functions ────────────────────────────────
  const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number): number | null => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = (brng * 180) / Math.PI;
    brng = (brng + 360) % 360;
    return isNaN(brng) ? null : Math.round(brng);
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

  const fetchNavRoute = async (startLat: number, startLon: number, target: MapSpot) => {
    try {
      const coordsStr = `${startLon},${startLat};${target.longitude},${target.latitude}`;
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=true`
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
        setBuilderNavRouteCoords(coords);
        
        const steps: any[] = [];
        route.legs.forEach((leg: any, legIdx: number) => {
          leg.steps.forEach((step: any) => {
            steps.push({
              instruction: step.maneuver.instruction,
              type: step.maneuver.type,
              modifier: step.maneuver.modifier,
              distance: step.distance,
              duration: step.duration,
              location: step.maneuver.location,
            });
          });
        });
        
        setBuilderNavSteps(steps);
        setBuilderCurrentStepIndex(0);

        const distanceKm = (route.distance / 1000).toFixed(1);
        const mins = Math.round(route.duration / 60);
        const durationText = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
        
        const etaDate = new Date();
        etaDate.setSeconds(etaDate.getSeconds() + route.duration);
        const etaText = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setBuilderNavStats(prev => ({
          distance: distanceKm,
          duration: durationText,
          eta: etaText,
          currentSpeed: prev?.currentSpeed || 0
        }));
        
        return coords;
      }
    } catch (err) {
      console.error("Error fetching OSRM navigation route:", err);
      toast.error("Failed to fetch routing path");
    }
    return null;
  };

  const speakInstruction = (text: string) => {
    if (isMuted || typeof window === "undefined" || !window.speechSynthesis) return;
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const startBuilderNavigation = () => {
    if (stops.length === 0) {
      toast.error("Please add at least one stop to start navigation");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("GPS location is not supported by your browser");
      return;
    }

    setNavStartTime(new Date());
    setBuilderNavActive(true);
    setBuilderNavPaused(false);
    setBuilderCurrentStopIndex(0);
    setVisitedStops([]);
    setTotalDistanceTraveled(0);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        lastLocationRef.current = loc;
        setPanTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 16 });

        const firstStop = stops[0];
        speakInstruction(`Starting navigation to ${firstStop.name}`);
        toast.success(`Navigation started to ${firstStop.name}`);
        await fetchNavRoute(pos.coords.latitude, pos.coords.longitude, firstStop);
      },
      (err) => {
        console.error("GPS initialization error:", err);
        setGpsPermissionDenied(true);
        toast.error("GPS access denied. Enable location access.");
        stopBuilderNavigation();
      },
      { enableHighAccuracy: true }
    );

    builderWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        handleNavigationUpdate(pos);
      },
      (err) => {
        console.error("Watch location updates error:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    ) as unknown as number;
  };

  const handleNavigationUpdate = async (pos: GeolocationPosition) => {
    if (builderNavPaused) return;

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const loc = { latitude: lat, longitude: lon };
    setUserLocation(loc);

    if (lastLocationRef.current) {
      const prev = lastLocationRef.current;
      const heading = calculateHeading(prev.latitude, prev.longitude, lat, lon);
      if (heading !== null) {
        setUserHeading(heading);
      }
      const stepDist = haversineKm(prev.latitude, prev.longitude, lat, lon);
      if (stepDist > 0.005) {
        setTotalDistanceTraveled(prevDist => prevDist + stepDist);
      }
    }
    lastLocationRef.current = loc;
    setPanTo({ lat, lon });

    const rawSpeed = pos.coords.speed;
    const currentSpeed = (rawSpeed && rawSpeed > 0) ? Math.round(rawSpeed * 3.6) : 0;

    const activeStop = stops[builderCurrentStopIndex];
    if (!activeStop) return;

    const distToStop = haversineKm(lat, lon, activeStop.latitude, activeStop.longitude);
    if (distToStop < 0.05) {
      speakInstruction(`You have arrived at ${activeStop.name}`);
      toast.success(`Arrived at: ${activeStop.name}`);
      setVisitedStops(prev => [...prev, activeStop.name]);

      const nextIdx = builderCurrentStopIndex + 1;
      if (nextIdx < stops.length) {
        setBuilderCurrentStopIndex(nextIdx);
        const nextStop = stops[nextIdx];
        speakInstruction(`Navigating to next stop: ${nextStop.name}`);
        toast(`Next target: ${nextStop.name}`, { icon: "ℹ️" });
        await fetchNavRoute(lat, lon, nextStop);
      } else {
        speakInstruction("You have reached your final destination. Navigation completed.");
        toast.success("Destination reached! Navigation completed.");
        await saveNavigationHistoryLog();
        stopBuilderNavigation();
      }
      return;
    }

    if (builderNavRouteCoords.length >= 2) {
      let minDist = Infinity;
      for (let i = 0; i < builderNavRouteCoords.length - 1; i++) {
        const segDist = pointToSegmentDist(
          lat, lon,
          builderNavRouteCoords[i].latitude, builderNavRouteCoords[i].longitude,
          builderNavRouteCoords[i+1].latitude, builderNavRouteCoords[i+1].longitude
        );
        if (segDist < minDist) minDist = segDist;
      }
      if (minDist > REROUTE_THRESHOLD_KM) {
        speakInstruction("Rerouting...");
        toast("Off-route detected. Recalculating...", { icon: "⚠️" });
        await fetchNavRoute(lat, lon, activeStop);
        return;
      }
    }

    if (builderNavSteps.length > 0) {
      let closestStepIdx = builderCurrentStepIndex;
      let minStepDist = Infinity;
      for (let i = builderCurrentStepIndex; i < Math.min(builderNavSteps.length, builderCurrentStepIndex + 3); i++) {
        const step = builderNavSteps[i];
        if (step.location) {
          const d = haversineKm(lat, lon, step.location[1], step.location[0]);
          if (d < minStepDist) {
            minStepDist = d;
            closestStepIdx = i;
          }
        }
      }
      if (closestStepIdx !== builderCurrentStepIndex) {
        setBuilderCurrentStepIndex(closestStepIdx);
      }

      const nextManeuver = builderNavSteps[closestStepIdx + 1];
      if (nextManeuver && nextManeuver.location) {
        const distToManeuver = haversineKm(lat, lon, nextManeuver.location[1], nextManeuver.location[0]) * 1000;
        if (distToManeuver < 150 && distToManeuver > 30) {
          speakInstruction(`In ${Math.round(distToManeuver)} meters, ${nextManeuver.instruction}`);
        }
      } else if (builderNavSteps[closestStepIdx]) {
        const distToStopM = distToStop * 1000;
        if (distToStopM < 300 && distToStopM > 100) {
          speakInstruction(`In ${Math.round(distToStopM)} meters, you will arrive at your destination.`);
        }
      }
    }

    setBuilderNavStats(prev => {
      const remainingDist = distToStop.toFixed(1);
      const durationMins = Math.ceil(distToStop * 1.5 + 2);
      const durationText = durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins / 60)} hr ${durationMins % 60} min`;
      const etaDate = new Date();
      etaDate.setMinutes(etaDate.getMinutes() + durationMins);
      const etaText = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        distance: remainingDist,
        duration: durationText,
        eta: etaText,
        currentSpeed: currentSpeed
      };
    });
  };

  const pauseBuilderNavigation = () => {
    setBuilderNavPaused(true);
    speakInstruction("Navigation paused");
    toast("Navigation paused");
  };

  const resumeBuilderNavigation = () => {
    setBuilderNavPaused(false);
    speakInstruction("Navigation resumed");
    toast("Navigation resumed");
  };

  const stopBuilderNavigation = () => {
    if (builderWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(builderWatchIdRef.current);
      builderWatchIdRef.current = null;
    }
    setBuilderNavActive(false);
    setBuilderNavPaused(false);
    setUserLocation(null);
    setUserHeading(null);
    setBuilderNavRouteCoords([]);
    setBuilderNavSteps([]);
    setBuilderNavStats(null);
    lastLocationRef.current = null;
    speakInstruction("Navigation stopped");
    toast("Navigation stopped");
  };

  const saveNavigationHistoryLog = async () => {
    if (!user) return;
    try {
      const selectedTrip = userTrips.find(t => t.id === selectedTripId);
      const tripName = selectedTrip ? (selectedTrip.name || selectedTrip.tripName) : "Custom Built Route";
      const payload = {
        userId: user.uid,
        tripId: selectedTripId || null,
        tripName: tripName,
        startTime: navStartTime || new Date(),
        endTime: new Date(),
        distanceTraveled: `${totalDistanceTraveled.toFixed(2)} km`,
        stopsVisited: visitedStops,
        createdAt: new Date(),
      };
      await addDoc(collection(db, "navigationHistory"), payload);
      toast.success("Navigation history saved!");
    } catch (err) {
      console.error("Error saving navigation history:", err);
    }
  };


  // ── EXPLORE: Add to Favorites ─────────────────────────────────────────────
  const addToFavorites = async (place: POIMarker) => {
    if (!user) { toast.error("Please log in first"); return; }
    const q = query(collection(db, "favorites"), where("name", "==", place.name), where("userId", "==", user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) { toast.error("Already in favorites ❤️"); return; }
    const imgs = [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600",
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600",
    ];
    await addDoc(collection(db, "favorites"), {
      name: place.name, rating: place.rating || "4.7", address: place.address || "Location",
      image: imgs[place.name.length % 3], crowd: "Medium",
      lat: place.latitude, lon: place.longitude, userId: user.uid, createdAt: new Date(),
    });
    toast.success(`❤️ Added "${place.name}" to Favorites!`);
  };

  // ── EXPLORE: Add to Route builder ─────────────────────────────────────────
  const addToRoute = async (place: POIMarker) => {
    const item: Suggestion = { name: place.name, address: place.address || "", latitude: place.latitude, longitude: place.longitude };
    setMode("builder");
    await addBuilderStop(item);
    setSelectedPlace(null);
  };

  // ── Compute displayed POI markers with fav/visited overlays ──────────────
  const computedPOI: POIMarker[] = [...poiMarkers];
  favPlaces.forEach((f) => {
    if (f.lat && f.lon && !computedPOI.some((p) => p.name === f.name)) {
      computedPOI.push({ name: f.name, type: "favorite", rating: f.rating || "4.8", address: f.address || "", latitude: f.lat, longitude: f.lon, pinColor: "#EF4444" });
    }
  });
  visitedPlaces.forEach((v) => {
    if (v.lat && v.lon) {
      const idx = computedPOI.findIndex((p) => p.name === v.name);
      if (idx !== -1) { computedPOI[idx] = { ...computedPOI[idx], type: "both", pinColor: "#F59E0B" }; }
      else computedPOI.push({ name: v.name, type: "visited", rating: v.rating || "4.8", address: v.address || "", latitude: v.lat, longitude: v.lon, pinColor: "#10B981" });
    }
  });

  const filteredPOI = computedPOI.filter((m) => {
    if (poiFilter === "all") return true;
    if (poiFilter === "sights") return ["sight", "museum", "temple"].includes(m.type);
    if (poiFilter === "cafes") return ["cafe", "restaurant"].includes(m.type);
    if (poiFilter === "hotels") return m.type === "hotel";
    return true;
  });

  // ── Mode-specific map props ───────────────────────────────────────────────
  const mapProps = {
    poiMarkers: mode === "explore" ? filteredPOI.slice(0, 80) : [],
    onPoiClick: mode === "explore" ? setSelectedPlace : undefined,
    spots: mode === "builder" ? stops : [],
    builderStart: mode === "builder" ? builderStartPlace : null,
    routeCoords: mode === "builder" ? builderRouteCoords : mode === "directions" ? directionsRouteCoords : [],
    routePolylineStyle: (mode === "builder" ? "dashed" : "solid") as "solid" | "dashed",
    directionsStart: mode === "directions" ? startPlace : null,
    directionsEnd: mode === "directions" ? destPlace : null,
    userLocation,
    panTo,
    height: "100%",
  };

  // ── Suggestion dropdown ───────────────────────────────────────────────────
  const SuggestionList = () => (
    suggestions.length > 0 ? (
      <div className="absolute top-full left-0 right-0 mt-1 z-[9999] bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSelectSuggestion(s)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left border-b border-white/5 last:border-0"
          >
            <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{s.name}</p>
              <p className="text-slate-500 text-[10px] truncate">{s.address}</p>
            </div>
            {s.distLabel && (
              <span className="text-teal-400 text-[10px] font-mono shrink-0">{s.distLabel}</span>
            )}
          </button>
        ))}
      </div>
    ) : null
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Map className="h-7 w-7 text-teal-400" />
            TripSync Maps
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Explore · Directions · Route Builder — Full feature parity with Android
          </p>
        </div>
        <button
          onClick={locateMe}
          className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition"
        >
          <Crosshair className="h-4 w-4" />
          Locate Me
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 p-1 bg-slate-900/60 border border-white/5 rounded-2xl w-fit">
        {(["explore", "directions", "builder"] as Mode[]).map((m) => {
          const icons: Record<Mode, React.ReactNode> = {
            explore: <Compass className="h-4 w-4" />,
            directions: <Navigation2 className="h-4 w-4" />,
            builder: <Route className="h-4 w-4" />,
          };
          const labels: Record<Mode, string> = {
            explore: "Explore", directions: "Directions", builder: "Builder",
          };
          return (
            <button
              key={m}
              onClick={() => { setMode(m); setSuggestions([]); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition ${
                mode === m
                  ? "bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {icons[m]}
              {labels[m]}
            </button>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "75vh" }}>

        {/* ── Left Panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-3 overflow-y-auto" style={{ maxHeight: "75vh" }}>

          {/* ═══════════ EXPLORE MODE ═══════════ */}
          {mode === "explore" && (
            <>
              {/* Search */}
              <div className={`relative glass-panel p-4 rounded-2xl border border-white/5 space-y-3 transition-all duration-200 ${
                activeInput === "explore" ? "z-30" : "z-10"
              }`}>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Search className="h-4 w-4 text-teal-400" />
                  Search Destinations
                </h3>
                <div className={`relative ${activeInput === "explore" ? "z-[100]" : "z-10"}`}>
                  <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
                    <Search className="h-4 w-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        setActiveInput("explore");
                        debouncedSuggest(e.target.value);
                      }}
                      onFocus={() => setActiveInput("explore")}
                      placeholder="Search city, landmark, cafe…"
                      className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                    />
                    {searchText && (
                      <button onClick={() => { setSearchText(""); setSuggestions([]); }}>
                        <X className="h-4 w-4 text-slate-500 hover:text-white" />
                      </button>
                    )}
                  </div>
                  {activeInput === "explore" && <SuggestionList />}
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-1.5">
                  {POI_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setPoiFilter(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        poiFilter === c.id
                          ? "bg-teal-500/20 border border-teal-500/30 text-teal-400"
                          : "bg-slate-900 border border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {loadingPOI && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
                    Loading nearby places…
                  </div>
                )}

                <div className="text-slate-500 text-xs">
                  {filteredPOI.length} pins visible on map
                </div>
              </div>

              {/* Legend */}
              <div className="relative z-0 glass-panel p-4 rounded-2xl border border-white/5">
                <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">Pin Legend</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    ["🍽", "Restaurant", "#F97316"], ["☕", "Café", "#06B6D4"],
                    ["🏨", "Hotel", "#EC4899"], ["🏛", "Sight", "#EAB308"],
                    ["🌿", "Park", "#10B981"], ["❤️", "Favorite", "#EF4444"],
                    ["✅", "Visited", "#10B981"], ["⭐", "Both", "#F59E0B"],
                  ].map(([emoji, label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span>{emoji}</span>
                      <span className="text-slate-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Place Card */}
              {selectedPlace && (
                <div className="relative z-0 glass-panel p-4 rounded-2xl border border-teal-500/20 space-y-3">
                  <button
                    onClick={() => setSelectedPlace(null)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div>
                    <h3 className="text-white font-bold text-base pr-6 leading-tight">{selectedPlace.name}</h3>
                    <p className="text-slate-400 text-xs mt-1 truncate">{selectedPlace.address}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-yellow-400 text-xs font-bold">⭐ {selectedPlace.rating}</span>
                      <span className="text-slate-500 text-xs uppercase">{selectedPlace.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToRoute(selectedPlace)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2 rounded-xl text-xs font-semibold hover:bg-teal-500/20 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Route
                    </button>
                    <button
                      onClick={() => addToFavorites(selectedPlace)}
                      className="flex items-center justify-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-2 px-3 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition"
                    >
                      <Heart className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════ DIRECTIONS MODE ═══════════ */}
          {mode === "directions" && (
            <>
              <div className={`relative glass-panel p-4 rounded-2xl border border-white/5 space-y-3 transition-all duration-200 ${
                (activeInput === "dir_start" || activeInput === "dir_dest") ? "z-30" : "z-10"
              }`}>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Navigation2 className="h-4 w-4 text-teal-400" />
                  Get Directions
                </h3>

                {/* Start */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
                    Start Point
                  </label>
                  <div className={`relative ${activeInput === "dir_start" ? "z-[100]" : "z-10"}`}>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
                      <input
                        type="text"
                        value={startText}
                        onChange={(e) => {
                          setStartText(e.target.value);
                          setActiveInput("dir_start");
                          debouncedSuggest(e.target.value);
                        }}
                        onFocus={() => setActiveInput("dir_start")}
                        placeholder="From…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!userLocation) { locateMe(); return; }
                          setStartPlace({ name: "My Location", latitude: userLocation.latitude, longitude: userLocation.longitude });
                          setStartText("My Location");
                        }}
                        className="shrink-0 text-teal-400 hover:text-teal-300"
                        title="Use my location"
                      >
                        <Crosshair className="h-4 w-4" />
                      </button>
                    </div>
                    {activeInput === "dir_start" && <SuggestionList />}
                  </div>
                </div>

                {/* Destination */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    Destination
                  </label>
                  <div className={`relative ${activeInput === "dir_dest" ? "z-[100]" : "z-10"}`}>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
                      <input
                        type="text"
                        value={destText}
                        onChange={(e) => {
                          setDestText(e.target.value);
                          setActiveInput("dir_dest");
                          debouncedSuggest(e.target.value);
                        }}
                        onFocus={() => setActiveInput("dir_dest")}
                        placeholder="To…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                      />
                    </div>
                    {activeInput === "dir_dest" && <SuggestionList />}
                  </div>
                </div>

                <button
                  onClick={calculateDirections}
                  disabled={!startPlace || !destPlace || calcLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                  {calcLoading ? "Calculating…" : "Get Route"}
                </button>
              </div>

              {/* Route Stats */}
              {directionsStats && (
                <div className="relative z-0 glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Fastest Route · OSRM</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-xl font-bold">{directionsStats.duration}</p>
                      <p className="text-teal-400 text-sm font-semibold">{directionsStats.distance} km</p>
                    </div>
                    <button
                      onClick={navActive ? stopNavigation : startNavigation}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                        navActive
                          ? "bg-rose-500/20 border border-rose-500/30 text-rose-400"
                          : "bg-teal-500 text-slate-950"
                      }`}
                    >
                      <Navigation2 className="h-4 w-4" />
                      {navActive ? "Stop" : "Navigate"}
                    </button>
                  </div>

                  {/* Navigation HUD */}
                  {navActive && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Route Progress</span>
                        <span className="text-teal-400 font-bold">{Math.round(navProgress * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${navProgress * 100}%` }}
                        />
                      </div>
                      <p className="text-slate-400 text-xs">Heading to <span className="text-white font-semibold">{destPlace?.name}</span></p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════ BUILDER MODE ═══════════ */}
          {mode === "builder" && (
            <>
              {/* Builder Header */}
              <div className={`relative glass-panel p-4 rounded-2xl border border-white/5 space-y-3 transition-all duration-200 ${
                (activeInput === "builder_start" || activeInput === "builder_add") ? "z-30" : "z-10"
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <Route className="h-4 w-4 text-teal-400" />
                    {editingRouteName ? (
                      <span className="truncate max-w-[140px]">
                        Editing: <span className="text-teal-400">{editingRouteName}</span>
                      </span>
                    ) : (
                      `Builder · ${stops.length} stops`
                    )}
                  </h3>
                  <button onClick={newRoute} className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded-lg transition">
                    New
                  </button>
                </div>

                {/* Trip Link selection dropdowns */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/45 p-2 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Link to Trip</label>
                    <select
                      value={selectedTripId}
                      onChange={(e) => setSelectedTripId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-teal-500 transition text-xs"
                    >
                      <option value="">-- No Trip --</option>
                      {userTrips.map((t) => (
                        <option key={t.id} value={t.id}>{t.name || t.destination}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trip Day</label>
                    <select
                      value={selectedDayNumber}
                      onChange={(e) => setSelectedDayNumber(Number(e.target.value))}
                      disabled={!selectedTripId}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-teal-500 transition text-xs disabled:opacity-40"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Start Location */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block flex items-center gap-1.5">
                    <Home className="h-3 w-3" /> Start Location
                  </label>
                  <div className={`relative ${activeInput === "builder_start" ? "z-[100]" : "z-10"}`}>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
                      <input
                        type="text"
                        value={builderStartText}
                        onChange={(e) => {
                          setBuilderStartText(e.target.value);
                          setActiveInput("builder_start");
                          debouncedSuggest(e.target.value);
                        }}
                        onFocus={() => setActiveInput("builder_start")}
                        placeholder="Custom start or use GPS…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!userLocation) { locateMe(); return; }
                          const gps: MapSpot = { name: "My Location", latitude: userLocation.latitude, longitude: userLocation.longitude };
                          setBuilderStartPlace(gps);
                          setBuilderStartText("My Location");
                          updateBuilderPolyline(stops, gps);
                        }}
                        className="shrink-0 text-teal-400"
                        title="Use GPS"
                      >
                        <Crosshair className="h-4 w-4" />
                      </button>
                    </div>
                    {activeInput === "builder_start" && <SuggestionList />}
                  </div>
                </div>

                {/* Add Stop */}
                <div>
                  <label className="text-xs text-slate-400 font-medium mb-1 block flex items-center gap-1.5">
                    <Flag className="h-3 w-3 text-teal-400" /> Add Stop
                  </label>
                  <div className={`relative ${activeInput === "builder_add" ? "z-[100]" : "z-10"}`}>
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5">
                      <Search className="h-4 w-4 text-slate-500 shrink-0" />
                      <input
                        type="text"
                        value={builderAddText}
                        onChange={(e) => {
                          setBuilderAddText(e.target.value);
                          setActiveInput("builder_add");
                          debouncedSuggest(e.target.value);
                        }}
                        onFocus={() => setActiveInput("builder_add")}
                        placeholder="Search & add stop…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                      />
                    </div>
                    {activeInput === "builder_add" && <SuggestionList />}
                  </div>
                </div>

                {/* Route Stats */}
                {builderStats && (
                  <div className="flex gap-4 text-xs border-t border-white/5 pt-2">
                    <span className="text-slate-400">Distance: <span className="text-teal-400 font-bold">{builderStats.distance} km</span></span>
                    <span className="text-slate-400">Time: <span className="text-teal-400 font-bold">{builderStats.duration}</span></span>
                  </div>
                )}
              </div>

              {/* Stop List */}
              {stops.length > 0 && (
                <div className="relative z-0 glass-panel rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-white font-semibold text-sm">{stops.length} Stop{stops.length !== 1 ? "s" : ""}</h4>
                    {stops.length >= 3 && (
                      <button
                        onClick={optimizeRoute}
                        disabled={optimizing}
                        className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 px-3 py-1.5 rounded-lg hover:bg-teal-500/20 transition"
                      >
                        {optimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
                        Optimize
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                    {stops.map((stop, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition group">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>
                        <p className="flex-1 text-white text-xs font-semibold truncate">{stop.name}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => moveStop(idx, "up")} disabled={idx === 0} className="text-slate-500 hover:text-teal-400 disabled:opacity-30">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveStop(idx, "down")} disabled={idx === stops.length - 1} className="text-slate-500 hover:text-teal-400 disabled:opacity-30">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => removeStop(idx)} className="text-slate-500 hover:text-rose-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {stops.length === 0 && (
                <div className="relative z-0 glass-panel p-6 rounded-2xl border border-dashed border-white/10 text-center">
                  <Route className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Set a start location and search stops above to build your route.</p>
                </div>
              )}

              {/* ── START NAVIGATION BUTTON ── */}
              {stops.length > 0 && !builderNavActive && (
                <button
                  onClick={startBuilderNavigation}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 py-3.5 rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-200"
                >
                  <Play className="h-5 w-5 fill-slate-950" />
                  Start Navigation
                </button>
              )}

              {/* ── STOP / PAUSE CONTROLS (active nav) ── */}
              {builderNavActive && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={builderNavPaused ? resumeBuilderNavigation : pauseBuilderNavigation}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                      builderNavPaused
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                        : "bg-slate-700/40 border-white/10 text-slate-300 hover:bg-slate-700/60"
                    }`}
                  >
                    {builderNavPaused ? <Play className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                    {builderNavPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={() => setIsMuted(m => !m)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                      isMuted
                        ? "bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30"
                        : "bg-slate-700/40 border-white/10 text-slate-300 hover:bg-slate-700/60"
                    }`}
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    {isMuted ? "Muted" : "Voice"}
                  </button>
                  <button
                    onClick={stopBuilderNavigation}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition active:scale-95"
                  >
                    <Square className="h-3.5 w-3.5 fill-rose-400" />
                    End Nav
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              {stops.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => saveRoute()}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2.5 rounded-xl text-xs font-bold hover:bg-teal-500/20 transition active:scale-95"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save Route
                  </button>
                  <button
                    onClick={saveAndShare}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 py-2.5 rounded-xl text-xs font-bold hover:bg-violet-500/20 transition active:scale-95"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Save & Share
                  </button>
                </div>
              )}

              {/* Load Route by ID */}
              <div className="relative z-0 glass-panel p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Load Shared Route</p>
                <div className="flex gap-2">
                  <input
                    id="load-route-input"
                    type="text"
                    placeholder="Paste route ID…"
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-600 outline-none focus:border-teal-500 transition"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("load-route-input") as HTMLInputElement;
                      if (input?.value.trim()) loadRouteById(input.value.trim());
                    }}
                    disabled={builderLoading}
                    className="bg-teal-500/20 border border-teal-500/30 text-teal-400 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-teal-500/30 transition"
                  >
                    {builderLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Map Panel ───────────────────────────────────────────────────── */}
        <div
          className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 overflow-hidden relative"
          style={{ height: "75vh", minHeight: "500px" }}
        >
          <LeafletMap {...mapProps} />

          {/* Map overlay badge */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-white text-xs font-semibold capitalize">{mode} mode</span>
            {mode === "explore" && <span className="text-slate-400 text-xs">· OpenStreetMap</span>}
            {mode === "directions" && directionsStats && (
              <span className="text-teal-400 text-xs">· {directionsStats.distance} km</span>
            )}
            {mode === "builder" && stops.length > 0 && !builderNavActive && (
              <span className="text-teal-400 text-xs">· {stops.length} stops</span>
            )}
            {builderNavActive && (
              <span className="text-emerald-400 text-xs font-bold animate-pulse">· NAVIGATING</span>
            )}
          </div>

          {/* ── NAVIGATION HUD OVERLAY ─────────────────────────────────────── */}
          {builderNavActive && (
            <div className="absolute inset-x-3 bottom-3 z-20 pointer-events-none">
              <div className="pointer-events-auto space-y-2">

                {/* Turn Instruction Banner */}
                {builderNavSteps.length > 0 && builderNavSteps[builderCurrentStepIndex] && (
                  <div className="flex items-center gap-3 bg-slate-950/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl px-4 py-3 shadow-2xl">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                      <Navigation2 className="h-5 w-5 text-slate-950" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm leading-tight">
                        {builderNavSteps[builderCurrentStepIndex].instruction || "Follow the route"}
                      </p>
                      {builderNavSteps[builderCurrentStepIndex + 1] && (
                        <p className="text-slate-400 text-xs mt-0.5 truncate">
                          Then: {builderNavSteps[builderCurrentStepIndex + 1].instruction}
                        </p>
                      )}
                    </div>
                    {userHeading !== null && (
                      <div
                        className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0"
                        style={{ transform: `rotate(${userHeading}deg)` }}
                      >
                        <ArrowRight className="h-4 w-4 text-teal-400" />
                      </div>
                    )}
                  </div>
                )}

                {/* Stats Row */}
                {builderNavStats && (
                  <div className="grid grid-cols-4 gap-2">
                    {/* Distance */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-teal-400 font-extrabold text-base leading-none">{builderNavStats.distance}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">km left</p>
                    </div>
                    {/* ETA */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-white font-extrabold text-base leading-none">{builderNavStats.eta}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">ETA</p>
                    </div>
                    {/* Duration */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-emerald-400 font-extrabold text-base leading-none">{builderNavStats.duration}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">remaining</p>
                    </div>
                    {/* Speed */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-amber-400 font-extrabold text-base leading-none">{builderNavStats.currentSpeed}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">km/h</p>
                    </div>
                  </div>
                )}

                {/* Stop Progress */}
                <div className="bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <Flag className="h-4 w-4 text-teal-400 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-xs font-semibold">
                        Stop {builderCurrentStopIndex + 1} / {stops.length}:
                        <span className="text-teal-400 ml-1">{stops[builderCurrentStopIndex]?.name}</span>
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {visitedStops.length} visited
                      </span>
                    </div>
                    {/* Stop dots */}
                    <div className="flex items-center gap-1">
                      {stops.map((s, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                            visitedStops.includes(s.name)
                              ? "bg-emerald-400"
                              : i === builderCurrentStopIndex
                              ? "bg-teal-400 animate-pulse"
                              : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {builderNavPaused && (
                    <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wide shrink-0">PAUSED</span>
                  )}
                  {gpsPermissionDenied && (
                    <span className="text-rose-400 text-[10px] font-bold uppercase tracking-wide shrink-0">GPS DENIED</span>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Share Modal ──────────────────────────────────────────────────────── */}
      {shareModalOpen && shareRouteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <Share2 className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Share Route 🗺️</h3>
                  <p className="text-slate-400 text-xs">{shareRouteName}</p>
                </div>
              </div>
              <button onClick={() => setShareModalOpen(false)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Route info */}
            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-slate-400 text-xs font-semibold mb-1">Route Name</p>
                <p className="text-white font-bold">{shareRouteName}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold mb-1.5">Web Link</p>
                <div className="flex items-center gap-2 bg-slate-950 border border-white/10 rounded-lg px-3 py-2">
                  <Globe className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <p className="text-teal-300 text-xs font-mono truncate flex-1">
                    {typeof window !== "undefined" ? cleanRouteUrl(window.location.origin, shareRouteId) : ""}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-semibold mb-1.5">Route ID</p>
                <div className="flex items-center gap-2 bg-slate-950 border border-white/10 rounded-lg px-3 py-2">
                  <p className="text-slate-300 text-xs font-mono truncate flex-1">{shareRouteId}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyShareLink}
                className="flex items-center justify-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 py-3 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition active:scale-95"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={() => {
                  const link = cleanRouteUrl(window.location.origin, shareRouteId);
                  const text = `Check out my travel route "${shareRouteName}" on TripSync! 🗺️\n${link}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition active:scale-95"
              >
                <Share2 className="h-4 w-4" />
                WhatsApp
              </button>
            </div>

            <button
              onClick={() => setShareModalOpen(false)}
              className="w-full text-center text-slate-500 text-sm hover:text-white transition py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export wrapped in Suspense (required for useSearchParams) ─────────────
export default function RoutesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    }>
      <MapPageContent />
    </Suspense>
  );
}
