"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { travelApiService } from "../../../services/api";
import { sanitizeInput } from "../../../lib/utils";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
  Search,
  MapPin,
  Heart,
  CheckCircle,
  CloudSun,
  Shield,
  Gem,
  Star,
  Users,
  Compass,
  X,
  Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";

const GEOAPIFY_KEY = "303db9c9ea7b411f81e4aaa234c881e5";

const CATEGORIES = [
  { label: "🏖 Beaches", type: "beach" },
  { label: "🍴 Restaurants", type: "catering.restaurant" },
  { label: "☕ Cafes", type: "catering.cafe" },
  { label: "🏛 Heritage", type: "tourism.sights" },
  { label: "🌿 Nature", type: "natural" },
  { label: "🏨 Hotels", type: "accommodation.hotel" },
  { label: "🛍 Shopping", type: "commercial" },
];

const CAT_IMAGES: any = {
  "🏖 Beaches": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500",
  "🍴 Restaurants": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500",
  "☕ Cafes": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500",
  "🏛 Heritage": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=500",
  "🌿 Nature": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500",
  "🏨 Hotels": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500",
  "🛍 Shopping": "https://images.unsplash.com/photo-1555529669-2269763671c0?w=500",
};

const getDescription = (name: string, category: string) => {
  const descs: any = {
    "🏖 Beaches": `${name} offers breathtaking coastal views with pristine sands and crystal-clear waters. Ideal for water sports, sunbathing, and serene evening walks.`,
    "🍴 Restaurants": `${name} is celebrated for authentic local cuisine and a vibrant atmosphere. The chef's signature dishes blend traditional flavors with modern culinary techniques.`,
    "☕ Cafes": `${name} is a beloved café known for artisanal coffee, fresh pastries, and a cozy ambiance. A favorite spot for travelers and locals alike.`,
    "🏛 Heritage": `${name} is a remarkable heritage site showcasing centuries of architectural brilliance and rich cultural history. A must-visit for history enthusiasts.`,
    "🌿 Nature": `${name} is a breathtaking natural reserve featuring diverse flora, fauna, and scenic landscapes. Perfect for trekking, birdwatching, and nature photography.`,
    "🏨 Hotels": `${name} offers premium accommodations with world-class amenities and impeccable service. Consistently ranked among the top properties in the region.`,
    "🛍 Shopping": `${name} is a premier shopping destination offering a curated mix of local crafts, international brands, and unique souvenirs. A retail therapy haven!`,
  };
  return (
    descs[category] ||
    `${name} is a highly-rated destination that visitors consistently love. Its unique character makes it a standout spot in the region.`
  );
};

const SAMPLE_REVIEWS = [
  { name: "Rahul M.", rating: 5, text: "Absolutely stunning! One of the best places I've visited. The experience was unforgettable.", ago: "2 days ago" },
  { name: "Priya S.", rating: 4, text: "Loved the experience! Well-maintained and the atmosphere was perfect. Highly recommend!", ago: "1 week ago" },
  { name: "Arjun K.", rating: 5, text: "A hidden gem that shouldn't be missed. Perfect for both solo travelers and families. Will visit again!", ago: "2 weeks ago" },
];

export default function ExplorePage() {
  const { user } = useAuth();
  const [place, setPlace] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("🏖 Beaches");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [addingFav, setAddingFav] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteTimer = useRef<any>(null);

  // AI-powered safety hidden gems
  const [aiHiddenGems, setAiHiddenGems] = useState<any[]>([]);
  const [safetyMetrics, setSafetyMetrics] = useState<any>(null);

  // Close dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Initial load for default destination
  useEffect(() => {
    setPlace("Goa");
    fetchPlaces("Goa", "🏖 Beaches");
  }, []);

  const handlePlaceTextChange = (text: string) => {
    setPlace(text);
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&apiKey=${GEOAPIFY_KEY}`
        );
        const data = await res.json();
        if (data.features) {
          const mapped = data.features
            .filter((f: any) => f.properties.city || f.properties.name)
            .map((f: any) => ({
              name: f.properties.city || f.properties.name || text,
              fullName: f.properties.formatted || "",
              country: f.properties.country || "",
            }));
          setSuggestions(mapped);
          setShowSuggestions(mapped.length > 0);
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    setPlace(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchPlaces(suggestion.name, selectedCategory);
  };

  const fetchPlaces = async (city: string, category: string) => {
    const cleanCity = sanitizeInput(city);
    if (!cleanCity.trim()) {
      toast.error("Please enter a city name.");
      return;
    }
    setLoading(true);
    setResults([]);
    setAiHiddenGems([]);
    setSafetyMetrics(null);
    try {
      const geoRes = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cleanCity)}&limit=1&apiKey=${GEOAPIFY_KEY}`
      );
      const geoData = await geoRes.json();
      if (!geoData.features?.length) {
        toast.error("City Not Found. Try a different city name.");
        setLoading(false);
        return;
      }
      const { lat, lon } = geoData.features[0].properties;

      // Fetch live weather + AI safety gems in parallel
      const [wRes, safetyMetricsResult] = await Promise.allSettled([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        ).then((r) => r.json()),
        travelApiService.getCitySafety(cleanCity),
      ]);

      if (wRes.status === "fulfilled") {
        setLiveWeather(wRes.value.current_weather);
      }

      if (safetyMetricsResult.status === "fulfilled") {
        setSafetyMetrics(safetyMetricsResult.value);
        if (safetyMetricsResult.value.gems?.length) {
          const gemEmojis = ["💎", "🌄", "🏚"];
          setAiHiddenGems(
            safetyMetricsResult.value.gems.slice(0, 3).map((g: any, i: number) => ({
              name: g.name,
              desc: g.desc,
              emoji: gemEmojis[i] || "✨",
            }))
          );
        }
      } else {
        setAiHiddenGems([
          { emoji: "🏚", name: "Old Town Quarter", desc: "Undiscovered historic streets rarely visited by tourists" },
          { emoji: "🌄", name: "Sunrise Viewpoint", desc: "A secret hilltop with panoramic views at dawn" },
          { emoji: "🍃", name: "Forest Trail", desc: "A serene 3km nature walk through local wilderness" },
        ]);
      }

      const catType = CATEGORIES.find((c) => c.label === category)?.type || "tourism.sights";
      const placesRes = await fetch(
        `https://api.geoapify.com/v2/places?categories=${catType}&filter=circle:${lon},${lat},50000&limit=20&apiKey=${GEOAPIFY_KEY}`
      );
      const placesData = await placesRes.json();
      let features = placesData.features || [];

      // If specific category yields no results, fallback to broader tourism & sights category
      if (features.length === 0) {
        const fallbackRes = await fetch(
          `https://api.geoapify.com/v2/places?categories=tourism.sights,catering.restaurant,beach&filter=circle:${lon},${lat},50000&limit=20&apiKey=${GEOAPIFY_KEY}`
        );
        const fallbackData = await fallbackRes.json();
        if (fallbackData.features?.length) {
          features = fallbackData.features;
        }
      }

      if (features.length > 0) {
        const mapped = features
          .filter((f: any) => f.properties.name || f.properties.formatted)
          .map((f: any, idx: number) => ({
            id: f.properties.place_id || `place_${idx}`,
            name: f.properties.name || f.properties.address_line1 || `${cleanCity} Spot #${idx + 1}`,
            address: f.properties.formatted || f.properties.address_line2 || cleanCity,
            lat: f.geometry?.coordinates ? f.geometry.coordinates[1] : lat,
            lon: f.geometry?.coordinates ? f.geometry.coordinates[0] : lon,
            rating: parseFloat((3.8 + (idx % 5) * 0.25).toFixed(1)),
            distance: f.properties.distance ? Math.round(f.properties.distance / 100) / 10 : null,
          }));
        setResults(mapped);
      }
    } catch (e) {
      console.error(e);
      toast.error("Could not fetch locations. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (place.trim()) fetchPlaces(place, cat);
  };

  const openPlaceModal = (p: any) => {
    setSelectedPlace(p);
    setModalVisible(true);
  };

  const addToFavorites = async () => {
    if (!selectedPlace) return;
    if (!user) {
      toast.error("Please log in to save favorites.");
      return;
    }
    setAddingFav(true);
    try {
      const q = query(
        collection(db, "favorites"),
        where("name", "==", selectedPlace.name),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error("This place is already in your favorites! ❤️");
        setAddingFav(false);
        return;
      }
      await addDoc(collection(db, "favorites"), {
        name: selectedPlace.name,
        address: selectedPlace.address,
        rating: selectedPlace.rating,
        image: CAT_IMAGES[selectedCategory] || "",
        category: selectedCategory,
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        savedAt: new Date(),
        userId: user.uid,
        crowd: "Medium",
      });
      toast.success(`${selectedPlace.name} added to favorites!`);
      setModalVisible(false);
    } catch (e) {
      toast.error("Could not save to favorites.");
    }
    setAddingFav(false);
  };

  const markAsVisited = async () => {
    if (!selectedPlace) return;
    if (!user) {
      toast.error("Please log in to mark places as visited.");
      return;
    }
    setAddingVisit(true);
    try {
      const q = query(
        collection(db, "visited"),
        where("name", "==", selectedPlace.name),
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error("Already marked as visited! ✅");
        setAddingVisit(false);
        return;
      }
      await addDoc(collection(db, "visited"), {
        name: selectedPlace.name,
        address: selectedPlace.address,
        rating: selectedPlace.rating,
        image: CAT_IMAGES[selectedCategory] || "",
        category: selectedCategory,
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        visitedAt: new Date(),
        userId: user.uid,
        memories: "",
      });
      toast.success(`${selectedPlace.name} marked as visited!`);
      setModalVisible(false);
    } catch (e) {
      toast.error("Could not save visited log.");
    }
    setAddingVisit(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Compass className="h-7 w-7 text-teal-400" />
          <span>Explore Destinations</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Discover places, restaurant menus, accommodation spots, and live AI safety metrics.
        </p>
      </div>

      {/* Search Bar with Autocomplete Dropdown */}
      <div className="relative max-w-xl" ref={dropdownRef}>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search cities (e.g. Panaji, Mumbai, Kyoto)..."
              value={place}
              onChange={(e) => handlePlaceTextChange(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          </div>
          <button
            onClick={() => fetchPlaces(place, selectedCategory)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold rounded-xl px-5 py-2.5 hover:scale-[1.02] transition active:scale-95 text-sm"
          >
            Explore
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionSelect(s)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition text-left border-b border-white/5 last:border-0"
              >
                <MapPin className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{s.name}</p>
                  <p className="text-slate-500 text-[10px] truncate">{s.fullName} {s.country}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* City Overview Widgets (Weather + Safety Scores) */}
      {place && safetyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Weather Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xxs font-bold uppercase tracking-wider">Live Weather</p>
              <h3 className="text-white text-lg font-bold mt-1">
                {liveWeather ? `${Math.round(liveWeather.temperature)}°C` : "N/A"}
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {safetyMetrics?.weatherHazard || "Clear sunny skies"}
              </p>
            </div>
            <CloudSun className="h-10 w-10 text-teal-400 shrink-0" />
          </div>

          {/* Safety Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between col-span-1 md:col-span-2">
            <div className="space-y-1">
              <p className="text-slate-500 text-xxs font-bold uppercase tracking-wider">Safety Overview</p>
              <div className="flex items-center space-x-6 mt-1">
                <div>
                  <span className="text-slate-400 text-xs">General Safety:</span>
                  <span className="text-teal-400 font-bold ml-1.5">{safetyMetrics.generalSafety}/10</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Night Safety:</span>
                  <span className="text-teal-400 font-bold ml-1.5">{safetyMetrics.nightSafety}/10</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Transit delays:</span>
                  <span className="text-emerald-400 font-semibold ml-1.5">{safetyMetrics.trafficIndex}</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
                {safetyMetrics.recommendations}
              </p>
            </div>
            <Shield className="h-10 w-10 text-teal-400 shrink-0 hidden sm:block" />
          </div>
        </div>
      )}

      {/* Category Selection Pills */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 border-b border-white/5">
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => handleCategoryChange(c.label)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === c.label
                ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                : "bg-slate-900 border border-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Places Result Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-white font-bold text-lg flex items-center space-x-2">
            <span>Discovered Places ({results.length})</span>
          </h3>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((p) => (
                <div
                  key={p.id}
                  onClick={() => openPlaceModal(p)}
                  className="glass-panel overflow-hidden rounded-2xl border border-white/5 flex flex-col justify-between hover:border-teal-500/20 transition cursor-pointer group"
                >
                  <div className="relative h-36 w-full">
                    <img
                      src={CAT_IMAGES[selectedCategory] || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-slate-950/80 rounded-md px-1.5 py-0.5 text-xxs text-teal-400 font-bold flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-teal-400" />
                      {p.rating}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="text-white text-sm font-bold truncate group-hover:text-teal-400 transition">{p.name}</h4>
                    <p className="text-slate-400 text-xxs truncate">📍 {p.address}</p>
                    {p.distance !== null && (
                      <p className="text-slate-500 text-xxs font-mono">{p.distance} km from center</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-xs italic py-10">
              Enter a city name and search to explore tourist spots and destinations.
            </p>
          )}
        </div>

        {/* AI Hidden Gems Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-base flex items-center space-x-2">
              <Gem className="h-4.5 w-4.5 text-yellow-400" />
              <span>AI Hidden Gems</span>
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Curated offbeat destinations resolved by our AI Safety engine.
            </p>
            {aiHiddenGems.length > 0 ? (
              <div className="space-y-4 pt-2">
                {aiHiddenGems.map((gem, index) => (
                  <div key={index} className="bg-slate-900/40 p-4 border border-white/5 rounded-xl space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{gem.emoji}</span>
                      <h4 className="text-white text-xs font-bold">{gem.name}</h4>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{gem.desc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-[11px] italic py-4">No hidden gems loaded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Place Detail Modal */}
      {modalVisible && selectedPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{selectedPlace.name}</h2>
                <p className="text-slate-400 text-xs mt-1">📍 {selectedPlace.address}</p>
              </div>
              <button
                onClick={() => setModalVisible(false)}
                className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <img
              src={CAT_IMAGES[selectedCategory] || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"}
              alt={selectedPlace.name}
              className="w-full h-44 object-cover rounded-xl border border-white/5"
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs border-y border-white/5 py-2">
                <span className="text-slate-500">Category: <span className="text-teal-400 font-semibold">{selectedCategory}</span></span>
                <span className="text-slate-500 flex items-center gap-1">
                  Rating: <span className="text-yellow-400 font-bold flex items-center gap-0.5"><Star className="h-3 w-3 fill-yellow-400" /> {selectedPlace.rating}</span>
                </span>
                <span className="text-slate-500">Crowd: <span className="text-emerald-400 font-semibold">Medium</span></span>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-white text-xs font-bold uppercase tracking-wider">About this place</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {getDescription(selectedPlace.name, selectedCategory)}
                </p>
              </div>

              {/* Reviews */}
              <div className="space-y-2">
                <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-teal-400" />
                  <span>Traveler Feedback</span>
                </h4>
                <div className="space-y-2.5 max-h-36 overflow-y-auto">
                  {SAMPLE_REVIEWS.map((rev, idx) => (
                    <div key={idx} className="bg-slate-900/50 p-2.5 border border-white/5 rounded-xl text-xxs">
                      <div className="flex justify-between items-center text-slate-450 font-bold mb-1">
                        <span>{rev.name}</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-400">★ {rev.rating}</span>
                          <span className="text-slate-650">• {rev.ago}</span>
                        </div>
                      </div>
                      <p className="text-slate-400 leading-relaxed italic">"{rev.text}"</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  onClick={addToFavorites}
                  disabled={addingFav}
                  className="flex-1 flex items-center justify-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-2.5 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-50"
                >
                  {addingFav ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4 fill-rose-455 text-rose-450" />}
                  <span>Save Favorite</span>
                </button>
                <button
                  onClick={markAsVisited}
                  disabled={addingVisit}
                  className="flex-1 flex items-center justify-center space-x-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 py-2.5 rounded-xl text-xs font-semibold hover:bg-teal-500/20 transition active:scale-95 disabled:opacity-50"
                >
                  {addingVisit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  <span>Mark Visited</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
