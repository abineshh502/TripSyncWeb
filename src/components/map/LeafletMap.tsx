"use client";

import { useEffect, useRef } from "react";

// ── Public types used by the map page ──────────────────────────────────────
export type POIMarker = {
  name: string;
  type: string;
  rating?: string;
  address?: string;
  latitude: number;
  longitude: number;
  pinColor?: string;
};

export type MapSpot = {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
};

interface LeafletMapProps {
  /** Numbered builder stop markers */
  spots?: MapSpot[];
  /** Green home marker for builder start */
  builderStart?: MapSpot | null;
  /** OSRM or fallback polyline coords */
  routeCoords?: { latitude: number; longitude: number }[];
  /** solid = navigation, dashed = builder preview */
  routePolylineStyle?: "solid" | "dashed";
  /** Colored POI pins in explore mode */
  poiMarkers?: POIMarker[];
  /** Fires when user clicks a POI pin */
  onPoiClick?: (marker: POIMarker) => void;
  /** Green nav marker — directions mode */
  directionsStart?: MapSpot | null;
  /** Red flag marker — directions mode */
  directionsEnd?: MapSpot | null;
  /** Pulsing blue dot */
  userLocation?: { latitude: number; longitude: number } | null;
  /** Heading angle for navigation tracking */
  userHeading?: number | null;
  /** Fly map to this point when it changes */
  panTo?: { lat: number; lon: number; zoom?: number } | null;
  height?: string;
}

// Leaflet type aliases (avoid SSR import)
type LAny = any;

export default function LeafletMap({
  spots = [],
  builderStart,
  routeCoords,
  routePolylineStyle = "solid",
  poiMarkers = [],
  onPoiClick,
  directionsStart,
  directionsEnd,
  userLocation,
  userHeading = null,
  panTo,
  height = "400px",
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LAny>(null);
  const layersRef = useRef<LAny[]>([]);
  const polylineRef = useRef<LAny>(null);
  const onPoiClickRef = useRef(onPoiClick);
  useEffect(() => { onPoiClickRef.current = onPoiClick; }, [onPoiClick]);

  // ── Initialize + Redraw (single effect, re-runs on every prop change) ────
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled) return;

      // ── Init map once ──────────────────────────────────────────────────
      if (!mapRef.current && containerRef.current) {
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;

        const map = L.map(containerRef.current, {
          center: [13.0827, 80.2707] as [number, number],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap © CARTO",
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Inject dark theme styles once
        if (!document.getElementById("ts-map-css")) {
          const style = document.createElement("style");
          style.id = "ts-map-css";
          style.textContent = `
            .ts-popup .leaflet-popup-content-wrapper {
              background:#1e293b;border:1px solid rgba(255,255,255,.12);
              border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.55);color:#f1f5f9;
            }
            .ts-popup .leaflet-popup-content { margin:10px 13px; }
            .ts-popup .leaflet-popup-tip { background:#1e293b; }
            .leaflet-popup-close-button { color:#94a3b8!important; top:6px!important; right:8px!important; }
            .leaflet-control-zoom { border:none!important; border-radius:10px!important; overflow:hidden; }
            .leaflet-control-zoom a {
              background:#1e293b!important;border:1px solid rgba(255,255,255,.1)!important;
              color:#38bdf8!important;width:34px!important;height:34px!important;line-height:34px!important;
              font-size:18px!important;
            }
            .leaflet-control-zoom a:hover { background:#334155!important; }
            .leaflet-bar { box-shadow:0 4px 16px rgba(0,0,0,.45)!important; }
          `;
          document.head.appendChild(style);
        }

        mapRef.current = map;

        // Auto-invalidate size when container size changes (e.g. on tab switches)
        const ro = new ResizeObserver(() => {
          map.invalidateSize();
        });
        ro.observe(containerRef.current);
        (map as any)._resizeObserver = ro;
      }

      if (!mapRef.current) return;
      const map: LAny = mapRef.current;

      // ── Clear previous layers ──────────────────────────────────────────
      layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      layersRef.current = [];
      if (polylineRef.current) {
        try { map.removeLayer(polylineRef.current); } catch {}
        polylineRef.current = null;
      }

      // ── Icon helpers ───────────────────────────────────────────────────
      const pinIcon = (color: string, emoji: string) =>
        L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center;">
            <div style="width:26px;height:26px;border-radius:50%;background:${color};
              display:flex;align-items:center;justify-content:center;
              border:2px solid rgba(255,255,255,.25);
              box-shadow:0 3px 10px rgba(0,0,0,.45);font-size:13px;">${emoji}</div>
            <div style="width:0;height:0;border-left:5px solid transparent;
              border-right:5px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
          </div>`,
          iconSize: [26, 35],
          iconAnchor: [13, 35],
          popupAnchor: [0, -37],
        });

      const numIcon = (label: number | string, bg = "#14b8a6") =>
        L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};
            color:#0f172a;font-weight:700;font-size:12px;
            display:flex;align-items:center;justify-content:center;
            border:2px solid rgba(255,255,255,.3);
            box-shadow:0 3px 10px rgba(20,184,166,.3);">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -18],
        });

      const typeEmoji: Record<string, string> = {
        restaurant: "🍽", cafe: "☕", hotel: "🏨", medical: "🏥",
        shop: "🛍", park: "🌿", temple: "🛕", museum: "🏛",
        transport: "🚌", school: "🏫", favorite: "❤️",
        visited: "✅", both: "⭐", sight: "📍",
      };

      const popup = (html: string) => L.popup({ className: "ts-popup", maxWidth: 240 }).setContent(html);

      // ── 1. POI explore markers ─────────────────────────────────────────
      poiMarkers.forEach((poi) => {
        const icon = pinIcon(poi.pinColor || "#38bdf8", typeEmoji[poi.type] || "📍");
        const m: LAny = L.marker([poi.latitude, poi.longitude], { icon })
          .bindPopup(popup(`
            <div style="font-family:system-ui,sans-serif;min-width:160px;">
              <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:3px;">${poi.name}</div>
              ${poi.address ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">${poi.address}</div>` : ""}
              <div style="font-size:11px;color:#38bdf8;font-weight:600;">⭐ ${poi.rating || "4.5"} · ${poi.type}</div>
            </div>
          `))
          .addTo(map);
        m.on("click", () => onPoiClickRef.current?.(poi));
        layersRef.current.push(m);
      });

      // ── 2. Route builder stops (numbered) ─────────────────────────────
      spots.forEach((spot, idx) => {
        const m: LAny = L.marker([spot.latitude, spot.longitude], { icon: numIcon(idx + 1) })
          .bindPopup(popup(`
            <div style="font-family:system-ui,sans-serif;">
              <div style="font-weight:700;font-size:13px;color:#f1f5f9;">${idx + 1}. ${spot.name}</div>
              ${spot.address ? `<div style="font-size:11px;color:#94a3b8;">${spot.address}</div>` : ""}
            </div>
          `))
          .addTo(map);
        layersRef.current.push(m);
      });

      // ── 3. Builder start (green home) ──────────────────────────────────
      if (builderStart) {
        const m: LAny = L.marker([builderStart.latitude, builderStart.longitude], {
          icon: pinIcon("#10b981", "🏠"),
        })
          .bindPopup(popup(`<div style="font-family:system-ui;font-size:13px;font-weight:700;color:#10b981;">Start: ${builderStart.name}</div>`))
          .addTo(map);
        layersRef.current.push(m);
      }

      // ── 4. Directions start (teal nav) ────────────────────────────────
      if (directionsStart) {
        const m: LAny = L.marker([directionsStart.latitude, directionsStart.longitude], {
          icon: pinIcon("#10b981", "🧭"),
        })
          .bindPopup(popup(`<div style="font-family:system-ui;font-size:13px;font-weight:700;color:#10b981;">From: ${directionsStart.name}</div>`))
          .addTo(map);
        layersRef.current.push(m);
      }

      // ── 5. Directions end (red flag) ──────────────────────────────────
      if (directionsEnd) {
        const m: LAny = L.marker([directionsEnd.latitude, directionsEnd.longitude], {
          icon: pinIcon("#ef4444", "🚩"),
        })
          .bindPopup(popup(`<div style="font-family:system-ui;font-size:13px;font-weight:700;color:#ef4444;">To: ${directionsEnd.name}</div>`))
          .addTo(map);
        layersRef.current.push(m);
      }

      // ── 6. User location (pulsing blue dot or direction compass) ──────
      if (userLocation) {
        const useCompass = typeof userHeading === "number" && !isNaN(userHeading);
        const icon = L.divIcon({
          className: "",
          html: useCompass
            ? `<div style="transform: rotate(${userHeading}deg); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: transform 0.2s ease;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#14b8a6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                </svg>
               </div>`
            : `<div style="width:14px;height:14px;border-radius:50%;background:#38bdf8;
                border:3px solid white;box-shadow:0 0 0 5px rgba(56,189,248,.22);"></div>`,
          iconSize: useCompass ? [32, 32] : [14, 14],
          iconAnchor: useCompass ? [16, 16] : [7, 7],
        });
        const m: LAny = L.marker([userLocation.latitude, userLocation.longitude], { icon }).addTo(map);
        layersRef.current.push(m);
      }

      // ── 7. Route polyline ─────────────────────────────────────────────
      const lineCoords: [number, number][] | null =
        routeCoords && routeCoords.length >= 2
          ? routeCoords.map((c) => [c.latitude, c.longitude])
          : spots.length >= 2
          ? spots.map((s) => [s.latitude, s.longitude])
          : null;

      if (lineCoords) {
        const pl = L.polyline(lineCoords, {
          color: "#38bdf8",
          weight: 4,
          opacity: 0.88,
          dashArray: routePolylineStyle === "dashed" ? "10, 8" : undefined,
          lineJoin: "round",
        }).addTo(map);
        polylineRef.current = pl;
      }

      // ── 8. Auto-fit all visible points ────────────────────────────────
      const pts: [number, number][] = [
        ...poiMarkers.map((m): [number, number] => [m.latitude, m.longitude]),
        ...spots.map((s): [number, number] => [s.latitude, s.longitude]),
        ...(builderStart ? [[builderStart.latitude, builderStart.longitude] as [number, number]] : []),
        ...(directionsStart ? [[directionsStart.latitude, directionsStart.longitude] as [number, number]] : []),
        ...(directionsEnd ? [[directionsEnd.latitude, directionsEnd.longitude] as [number, number]] : []),
        ...(userLocation ? [[userLocation.latitude, userLocation.longitude] as [number, number]] : []),
      ];

      if (pts.length >= 2) {
        map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14, animate: true });
      } else if (pts.length === 1) {
        map.flyTo(pts[0], 14, { animate: true, duration: 0.8 });
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(spots),
    builderStart ? `${builderStart.latitude},${builderStart.longitude}` : null,
    JSON.stringify(routeCoords?.slice(0, 5)),
    routePolylineStyle,
    JSON.stringify(poiMarkers.slice(0, 5).map((p) => p.name)),
    directionsStart ? `${directionsStart.latitude},${directionsStart.longitude}` : null,
    directionsEnd ? `${directionsEnd.latitude},${directionsEnd.longitude}` : null,
    userLocation ? `${userLocation.latitude},${userLocation.longitude}` : null,
    userHeading,
  ]);

  // ── Programmatic fly-to ────────────────────────────────────────────────────
  useEffect(() => {
    if (!panTo || !mapRef.current) return;
    mapRef.current.flyTo([panTo.lat, panTo.lon], panTo.zoom ?? 14, { animate: true, duration: 1 });
  }, [panTo]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        try {
          if (mapRef.current._resizeObserver) {
            mapRef.current._resizeObserver.disconnect();
          }
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <div ref={containerRef} style={{ height, width: "100%" }} />
    </>
  );
}
