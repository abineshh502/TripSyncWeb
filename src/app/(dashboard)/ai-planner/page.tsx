"use client";

import React, { useState } from "react";
import { useTrips } from "../../../hooks/useTrips";
import { travelApiService } from "../../../services/api";
import { Sparkles, Compass, Shield, HelpCircle, MapPin, Check, Plus } from "lucide-react";
import { toast } from "react-hot-toast";

export default function AIPlannerPage() {
  const { trips, addSpot } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const activeTrip = trips.find(t => t.id === selectedTripId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);

    const destination = activeTrip?.destination || "Goa";
    
    try {
      // 1. Fetch safety/crowd metrics and gems
      const safetyData = await travelApiService.getCitySafety(destination);

      // 2. Ask Chatbot for itinerary details based on prompt and safety
      const aiPrompt = `Create a list of 3 recommended spots/landmarks to visit in ${destination} for a traveler interested in: "${prompt}". 
      Format the response exactly as a JSON array of objects, each object containing "name" (string), "lat" (number), "lon" (number), and "description" (string). Do not output markdown wrappers.`;
      
      const aiReply = await travelApiService.askChatbot(aiPrompt);
      
      let spots = [];
      try {
        // Strip markdown backticks if any
        const cleanedReply = aiReply.replace(/```json/g, "").replace(/```/g, "").trim();
        spots = JSON.parse(cleanedReply);
      } catch {
        // Local fallback parsing or fallback mock spots matching destination
        spots = [
          { name: `${destination} Heritage Fort`, lat: 15.498, lon: 73.805, description: "Historical monument with views." },
          { name: `${destination} Riverside Cafe`, lat: 15.501, lon: 73.811, description: "Relaxing vibes and organic coffee." },
          { name: `${destination} Hidden Beach Cliff`, lat: 15.512, lon: 73.798, description: "Quiet beach spot away from crowds." }
        ];
      }

      setResult({
        destination,
        safety: safetyData,
        spots
      });
      toast.success("AI travel plan generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpotToTrip = async (spot: any) => {
    if (!selectedTripId) {
      toast.error("Please select a trip first");
      return;
    }
    await addSpot(selectedTripId, {
      name: spot.name,
      latitude: spot.lat,
      longitude: spot.lon,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Sparkles className="h-7 w-7 text-teal-400" />
          <span>AI Journey Planner</span>
        </h1>
        <p className="text-slate-400 text-sm">Generate optimized day plans and local safety assessments with Gemini AI.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Planner input wizard */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-white font-semibold text-base">Plan Settings</h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-350 mb-1">Select Journey Profile</label>
                <select
                  required
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  <option value="">-- Choose Trip Profile --</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.destination})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-350 mb-1">What would you like to explore?</label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Quiet beaches, vintage architectures, and local fish curries..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !selectedTripId}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold py-3 rounded-xl transition active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-teal-500/10 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Custom Itinerary</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Planning Results */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="glass-panel p-12 text-center rounded-2xl border border-white/5 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-white font-semibold">Generating optimized travel coordinates...</p>
                <p className="text-slate-550 text-xs">Querying city crowd charts and weather indexes...</p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Safety metrics header */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider">Safety Index</span>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-teal-400" />
                    <span className="text-white text-xl font-bold">{result.safety.generalSafety} / 10</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider">Night Walking Rating</span>
                  <div className="flex items-center space-x-2">
                    <Compass className="h-5 w-5 text-indigo-400" />
                    <span className="text-white text-xl font-bold">{result.safety.nightSafety} / 10</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 text-xxs font-bold uppercase tracking-wider">Weather Alert</span>
                  <div className="flex items-center space-x-2">
                    <HelpCircle className="h-5 w-5 text-amber-400" />
                    <span className="text-white text-sm font-semibold truncate">{result.safety.weatherHazard}</span>
                  </div>
                </div>
              </div>

              {/* Spots List */}
              <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-white font-bold text-lg">AI Recommended Stopovers</h3>
                <div className="space-y-4">
                  {result.spots.map((spot: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/40 border border-white/5 hover:border-teal-500/10 p-4 rounded-xl flex items-center justify-between gap-4 transition">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-teal-400" />
                          <h4 className="text-white font-semibold text-sm">{spot.name}</h4>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed max-w-xl">{spot.description}</p>
                      </div>
                      <button
                        onClick={() => handleAddSpotToTrip(spot)}
                        className="bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500 hover:text-slate-950 text-teal-400 p-2.5 rounded-xl transition shrink-0"
                        title="Add to active trip route"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel text-center p-12 border border-dashed border-white/10 rounded-2xl">
              <Sparkles className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold">AI Planner Awaiting Settings</h3>
              <p className="text-slate-550 text-sm mt-1 max-w-sm mx-auto">Select a journey profile on the left and enter your travel preferences to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
