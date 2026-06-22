"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTrips } from "../../../hooks/useTrips";
import { useGroups } from "../../../hooks/useGroups";
import { travelApiService } from "../../../services/api";
import { 
  Sparkles, 
  MapPin, 
  IndianRupee, 
  Volume2, 
  VolumeX, 
  Compass, 
  ArrowRight,
  TrendingUp,
  Map,
  Bell
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "../../../lib/utils";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { trips } = useTrips();
  const { groups, calculateSplits } = useGroups();

  const [briefing, setBriefing] = useState<string>("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Active / Upcoming trip determination
  const activeTrip = trips && trips.length > 0 ? trips[0] : null;
  const activeGroup = groups && groups.length > 0 ? groups[0] : null;

  // Calculate expense statistics
  const stats = activeGroup ? calculateSplits(activeGroup) : { totalSpent: 0, settlements: [] };

  const fetchBriefing = async () => {
    if (!profile) return;
    setLoadingBriefing(true);
    try {
      const summary = await travelApiService.fetchVoiceBriefing({
        userName: profile.name,
        activeTripName: activeTrip?.name,
        activeTripDestination: activeTrip?.destination,
        todayScheduleTitle: activeTrip?.spots?.[0]?.name ? `Visit ${activeTrip.spots[0].name}` : undefined,
        todayScheduleSpots: activeTrip?.spots?.map(s => s.name),
        groupName: activeGroup?.groupName,
        groupExpensesCount: activeGroup?.expenses?.length,
        weatherTemp: 28,
        weatherDesc: "Clear Sunny Skies",
      });
      setBriefing(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBriefing(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchBriefing();
    }
  }, [profile, trips, groups]);

  const speakBriefing = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (!briefing) return;
    const utterance = new SpeechSynthesisUtterance(briefing);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome & AI Voice Briefing Widget */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-teal-950/40 via-emerald-950/20 to-slate-900 border border-white/10 rounded-2xl p-6 md:p-8">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Namaste, {profile?.name || "Traveler"} 🗺️
            </h1>
            <Link
              href="/notifications"
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition relative mt-1"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
            </Link>
          </div>
          <p className="text-slate-400 text-sm">
            Welcome to your travel command center. Let's explore new horizons.
          </p>
        </div>

        {/* AI Briefing Voice Button */}
        {briefing && (
          <button
            onClick={speakBriefing}
            className={`flex items-center space-x-3 rounded-xl border px-5 py-3 transition text-sm font-semibold ${
              isPlaying
                ? "bg-teal-500/20 border-teal-500/30 text-teal-400"
                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            }`}
          >
            {isPlaying ? (
              <>
                <VolumeX className="h-5 w-5 text-teal-400" />
                <span>Stop Briefing</span>
                {/* Voice waves animation */}
                <div className="flex space-x-0.5 items-center justify-center h-3">
                  <div className="w-0.5 bg-teal-400 h-2 animate-pulse" />
                  <div className="w-0.5 bg-teal-400 h-3 animate-pulse delay-75" />
                  <div className="w-0.5 bg-teal-400 h-1.5 animate-pulse delay-150" />
                </div>
              </>
            ) : (
              <>
                <Volume2 className="h-5 w-5 text-teal-400" />
                <span>Listen to AI Briefing</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Grid of Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Trip Widget */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-48">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-500 text-xxs font-bold uppercase tracking-wider">
              <span>Active Journey</span>
              <Compass className="h-4 w-4 text-teal-400" />
            </div>
            {activeTrip ? (
              <>
                <h3 className="text-white text-xl font-bold truncate">{activeTrip.name}</h3>
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{activeTrip.destination}</span>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">No active journeys scheduled.</p>
            )}
          </div>
          {activeTrip ? (
            <Link href={`/trips/${activeTrip.id}`} className="inline-flex items-center text-xs font-semibold text-teal-400 hover:text-teal-350 pt-4">
              <span>Manage Itinerary</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          ) : (
            <Link href="/trips" className="bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2 rounded-xl text-center text-xs font-semibold hover:bg-teal-500/20 transition">
              Create a Trip
            </Link>
          )}
        </div>

        {/* Group Spending */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-48">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-500 text-xxs font-bold uppercase tracking-wider">
              <span>Group Expenses</span>
              <IndianRupee className="h-4 w-4 text-emerald-400" />
            </div>
            {activeGroup ? (
              <>
                <h3 className="text-white text-2xl font-bold">{formatCurrency(stats.totalSpent)}</h3>
                <p className="text-slate-400 text-xs">
                  Active in: <span className="text-slate-300 font-semibold">{activeGroup.groupName}</span>
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">No active billing pools.</p>
            )}
          </div>
          {activeGroup ? (
            <Link href={`/groups/${activeGroup.id}`} className="inline-flex items-center text-xs font-semibold text-emerald-400 hover:text-emerald-350 pt-4">
              <span>Split Bills & Itinerary</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          ) : (
            <Link href="/groups" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-2 rounded-xl text-center text-xs font-semibold hover:bg-emerald-500/20 transition">
              Create / Join Group
            </Link>
          )}
        </div>

        {/* Route Optimization Status */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between h-48">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-500 text-xxs font-bold uppercase tracking-wider">
              <span>Optimal Routing</span>
              <TrendingUp className="h-4 w-4 text-teal-400" />
            </div>
            {activeTrip && activeTrip.spots && activeTrip.spots.length > 0 ? (
              <>
                <h3 className="text-white text-xl font-bold">{activeTrip.spots.length} Stops Mapped</h3>
                <p className="text-slate-400 text-xs">Itinerary path calculated dynamically</p>
              </>
            ) : (
              <p className="text-slate-500 text-sm italic">No routes calculated yet.</p>
            )}
          </div>
          {activeTrip ? (
            <Link href="/routes" className="inline-flex items-center text-xs font-semibold text-teal-400 hover:text-teal-350 pt-4">
              <span>Optimize Route Path</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          ) : (
            <Link href="/ai-planner" className="bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2 rounded-xl text-center text-xs font-semibold hover:bg-teal-500/20 transition">
              Launch AI Planner
            </Link>
          )}
        </div>
      </div>

      {/* Main dashboard content sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Itinerary Timeline */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-white font-bold text-lg flex items-center space-x-2">
            <Map className="h-5 w-5 text-teal-400" />
            <span>Today's Trip Timeline</span>
          </h3>
          {activeTrip && activeTrip.spots && activeTrip.spots.length > 0 ? (
            <div className="space-y-4 pt-2">
              {activeTrip.spots.map((spot, idx) => (
                <div key={idx} className="flex items-start space-x-3.5">
                  <div className="w-5 h-5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-semibold">{spot.name}</h4>
                    <p className="text-slate-500 text-xs">Target waypoint coord: {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic py-4">No timeline stops mapped for today. Open the Route map tab to pin destinations!</p>
          )}
        </div>

        {/* AI Briefing Summary Text */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-teal-400" />
              <span>AI Briefing summary</span>
            </h3>
            {loadingBriefing ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : briefing ? (
              <p className="text-slate-350 text-sm leading-relaxed italic bg-slate-900/40 p-4 border border-white/5 rounded-xl">
                "{briefing}"
              </p>
            ) : (
              <p className="text-slate-500 text-sm italic">Briefing not fetched yet.</p>
            )}
          </div>
          <button 
            onClick={fetchBriefing}
            className="text-xs font-semibold text-teal-400 hover:text-teal-350 hover:underline pt-2 text-left self-start"
          >
            Refresh Daily Summary
          </button>
        </div>
      </div>
    </div>
  );
}
