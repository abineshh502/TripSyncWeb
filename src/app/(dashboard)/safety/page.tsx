"use client";

import React, { useState } from "react";
import { travelApiService } from "../../../services/api";
import { SafetyMetrics } from "../../../types";
import { ShieldAlert, Search, Info, HelpCircle, Compass, CloudRain } from "lucide-react";
import { toast } from "react-hot-toast";

export default function SafetyPage() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<SafetyMetrics | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;

    setLoading(true);
    try {
      const data = await travelApiService.getCitySafety(city);
      setMetrics(data);
      toast.success(`Fetched safety data for ${city}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch safety metrics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <ShieldAlert className="h-7 w-7 text-teal-400" />
          <span>Safety & Crowd Advisor</span>
        </h1>
        <p className="text-slate-400 text-sm">Query safety scores, night walkability, and local recommendations dynamically.</p>
      </div>

      {/* Search Input bar */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 max-w-xl">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Enter destination (e.g. Goa, Manali, Mumbai...)"
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !city.trim()}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-650 hover:to-emerald-650 text-slate-950 px-6 py-3 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              "Query Advisor"
            )}
          </button>
        </form>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Gauges & Scores */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
              <h3 className="text-white font-bold text-base flex items-center space-x-2 border-b border-white/5 pb-3">
                <Info className="h-4.5 w-4.5 text-teal-400" />
                <span>Advisor Ratings — {metrics.city}</span>
              </h3>

              {/* General Safety score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>General Safety Index</span>
                  <span className="font-semibold text-teal-400">{metrics.generalSafety} / 10</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full"
                    style={{ width: `${metrics.generalSafety * 10}%` }}
                  />
                </div>
              </div>

              {/* Night Walking score */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Night Walking Safety Index</span>
                  <span className="font-semibold text-indigo-400">{metrics.nightSafety} / 10</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full"
                    style={{ width: `${metrics.nightSafety * 10}%` }}
                  />
                </div>
              </div>

              {/* Live Parameters */}
              <div className="pt-4 border-t border-white/5 space-y-3.5">
                <div className="flex justify-between items-center text-xs text-slate-350">
                  <span className="text-slate-500">Traffic Transit density:</span>
                  <span className="font-semibold text-white">{metrics.trafficIndex}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-350">
                  <span className="text-slate-500">Weather Hazard rating:</span>
                  <span className="font-semibold text-amber-400">{metrics.weatherHazard}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden Gems & Suggestions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recommendations notice */}
            {metrics.recommendations && (
              <div className="bg-teal-950/25 border border-teal-550/20 text-slate-300 p-5 rounded-2xl flex items-start space-x-3.5">
                <Compass className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-white font-bold text-sm">Security Recommendation</h4>
                  <p className="text-xs leading-relaxed">{metrics.recommendations}</p>
                </div>
              </div>
            )}

            {/* Hidden Gems list */}
            {metrics.gems && metrics.gems.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-white font-bold text-lg flex items-center space-x-2">
                  <CloudRain className="h-5 w-5 text-teal-400" />
                  <span>Curated Hidden Gems & Uncrowded Spots</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {metrics.gems.map((gem, idx) => (
                    <div key={idx} className="bg-slate-900/40 border border-white/5 p-4 rounded-xl space-y-1">
                      <h4 className="text-white font-semibold text-sm">{gem.name}</h4>
                      <p className="text-slate-450 text-xs leading-relaxed">{gem.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
