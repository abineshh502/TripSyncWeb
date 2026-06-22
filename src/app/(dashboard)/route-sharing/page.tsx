"use client";

import React, { useState } from "react";
import { useTrips } from "../../../hooks/useTrips";
import {
  Share2, Compass, Copy, Check, Send, AlertTriangle,
  MapPin, Calendar, Route, Users, ExternalLink, Globe,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  buildTripShareUrl,
  validateShareUrl,
} from "../../../lib/shareUtils";

export default function RouteSharingPage() {
  const { trips, loading } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState("");
  const [copied, setCopied] = useState(false);

  const activeTrip = trips.find((t) => t.id === selectedTripId);
  const spotsList = activeTrip?.spots || [];

  // ── Generate a validated, working share link ──────────────────────────────
  const getShareLink = (): string => {
    if (!selectedTripId) return "";
    const url = buildTripShareUrl(selectedTripId);
    if (!validateShareUrl(url)) return "";
    return url;
  };

  const shareLink = getShareLink();
  const isLinkValid = shareLink.length > 0;

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCopyLink = () => {
    if (!isLinkValid) {
      toast.error("Please select a trip first");
      return;
    }
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("📋 Share link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!activeTrip || !isLinkValid) {
      toast.error("Please select a trip first");
      return;
    }
    const text =
      `Hey! Check out our trip "${activeTrip.name || activeTrip.tripName}" ` +
      `to ${activeTrip.destination} on TripSync! 🌍\n${shareLink}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleOpenLink = () => {
    if (!isLinkValid) return;
    window.open(shareLink, "_blank");
  };

  // ── Format date helper ────────────────────────────────────────────────────
  const formatDate = (d: string | undefined) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Share2 className="h-7 w-7 text-teal-400" />
          Route &amp; Itinerary Sharing
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Generate shareable links to broadcast itineraries to group members.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left: Trip selector ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Choose a Trip</h3>

            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                Loading trips…
              </div>
            ) : trips.length === 0 ? (
              <p className="text-slate-500 text-sm">No trips found. Create a trip first.</p>
            ) : (
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
              >
                <option value="">— Choose a Trip —</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.tripName} {t.destination ? `(${t.destination})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Generated link preview */}
          {selectedTripId && (
            <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-2">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-teal-400" />
                Generated Link
              </p>
              {isLinkValid ? (
                <>
                  <p className="text-teal-300 text-xs font-mono break-all leading-relaxed">
                    {shareLink}
                  </p>
                  <button
                    onClick={handleOpenLink}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open link to verify
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-rose-400 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Could not generate a valid link
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Sharing hub ── */}
        <div className="lg:col-span-2">
          {activeTrip ? (
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
              {/* Trip summary header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-5">
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {activeTrip.name || activeTrip.tripName}
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Sharing hub for this trip
                  </p>
                </div>
                <span
                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
                    activeTrip.status === "ongoing"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : activeTrip.status === "completed"
                      ? "bg-slate-700/50 border-white/10 text-slate-400"
                      : "bg-teal-500/10 border-teal-500/30 text-teal-400"
                  }`}
                >
                  {activeTrip.status || "upcoming"}
                </span>
              </div>

              {/* Boarding card */}
              <div className="relative overflow-hidden bg-gradient-to-r from-teal-950/30 to-slate-900 border border-white/10 rounded-2xl p-6 aspect-[16/7]">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                      TripSync Boarding Card
                    </span>
                    <Compass className="h-5 w-5 text-teal-400" />
                  </div>

                  <div>
                    <h4 className="text-white text-2xl font-bold leading-tight">
                      {activeTrip.name || activeTrip.tripName}
                    </h4>
                    <p className="text-slate-400 text-sm flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-teal-400" />
                      {activeTrip.destination}
                    </p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="flex gap-6">
                      {activeTrip.startDate && (
                        <div>
                          <p className="text-slate-600 text-[9px] uppercase font-bold">Departs</p>
                          <p className="text-white text-xs font-semibold">{formatDate(activeTrip.startDate)}</p>
                        </div>
                      )}
                      {activeTrip.endDate && (
                        <div>
                          <p className="text-slate-600 text-[9px] uppercase font-bold">Returns</p>
                          <p className="text-white text-xs font-semibold">{formatDate(activeTrip.endDate)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-slate-600 text-[9px] uppercase font-bold">Stops</p>
                        <p className="text-white text-xs font-semibold">{spotsList.length} Waypoints</p>
                      </div>
                    </div>
                    <div className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1 rounded-xl text-[10px] font-semibold">
                      Live Route Card
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-3 text-center">
                  <Route className="h-4 w-4 text-teal-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{spotsList.length}</p>
                  <p className="text-slate-500 text-[10px]">Stops</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-3 text-center">
                  <Calendar className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{activeTrip.days?.length || "—"}</p>
                  <p className="text-slate-500 text-[10px]">Days</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-3 text-center">
                  <Users className="h-4 w-4 text-violet-400 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">{activeTrip.userIds?.length || 1}</p>
                  <p className="text-slate-500 text-[10px]">Members</p>
                </div>
              </div>

              {/* Share action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCopyLink}
                  disabled={!isLinkValid}
                  className="flex items-center justify-center gap-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? <Check className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Web Link"}
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  disabled={!isLinkValid}
                  className="flex items-center justify-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 py-3 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                  Share via WhatsApp
                </button>
              </div>

              {/* Link not valid warning */}
              {!isLinkValid && selectedTripId && (
                <div className="flex items-center gap-2.5 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Could not generate a valid share link. Please try again or refresh the page.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel text-center p-12 border border-dashed border-white/10 rounded-2xl">
              <Share2 className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold">Choose a Trip to Share</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                Select a journey from the left panel to generate and share your travel itinerary.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
