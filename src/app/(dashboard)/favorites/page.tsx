"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Heart, Trash, MapPin, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function FavoritesPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "favorites"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const temp: any[] = [];
        snapshot.forEach((docSnap) => {
          temp.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Sort by savedAt descending
        temp.sort((a, b) => {
          const aTime = a.savedAt?.toMillis?.() || a.savedAt?.seconds * 1000 || new Date(a.savedAt).getTime() || 0;
          const bTime = b.savedAt?.toMillis?.() || b.savedAt?.seconds * 1000 || new Date(b.savedAt).getTime() || 0;
          return bTime - aTime;
        });
        setFavorites(temp);
        setLoading(false);
      },
      (error) => {
        console.error("Favorites fetch error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleRemove = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, "favorites", id));
      toast.success(`"${name}" removed from favorites`);
    } catch (error) {
      console.error(error);
      toast.error("Could not remove from favorites");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Heart className="h-7 w-7 text-rose-500 fill-rose-500" />
          <span>Favorites ❤️</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Your saved premium destinations & landmarks synced across all devices.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : favorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((item, idx) => (
            <div
              key={item.id || idx}
              className="glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between hover:shadow-lg hover:shadow-rose-500/5 transition-all group bg-gradient-to-br from-slate-900/40 via-slate-950/20 to-slate-900"
            >
              <div>
                <img
                  src={item.image || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"}
                  alt={item.name}
                  className="w-full h-40 object-cover border-b border-white/5"
                />
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-white text-base font-bold truncate group-hover:text-rose-455 transition">
                      {item.name}
                    </h3>
                  </div>

                  {item.address && (
                    <div className="flex items-center space-x-2 text-slate-400 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{item.address}</span>
                    </div>
                  )}

                  {item.category && (
                    <span className="inline-flex items-center text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-550/20 rounded-md px-2 py-0.5 mt-1">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/40 border-t border-white/5 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-yellow-400 font-bold flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-yellow-400" />
                    {item.rating || "4.8"}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Crowd: {item.crowd || "Medium"}</span>
                </div>
                <button
                  onClick={() => handleRemove(item.id, item.name)}
                  className="text-slate-550 hover:text-rose-400 transition p-1.5 rounded-lg hover:bg-rose-500/10"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-panel text-center p-16 border border-dashed border-white/10 rounded-2xl">
          <Heart className="h-12 w-12 text-slate-650 mx-auto mb-4" />
          <h3 className="text-white text-xl font-bold mb-2">No Saved Destinations</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
            Go to the "Explore" screen to search cities and favorite beautiful landmarks.
          </p>
          <Link
            href="/explore"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-6 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 inline-block"
          >
            Start Exploring
          </Link>
        </div>
      )}

      {/* AI Assistant Widget at the bottom */}
      <Link
        href="/ai-assistant"
        className="block bg-gradient-to-r from-teal-950/40 via-emerald-950/20 to-slate-900 border border-white/10 rounded-2xl p-6 hover:border-teal-500/20 transition group"
      >
        <div className="flex items-center space-x-3 mb-2">
          <MessageSquare className="h-5 w-5 text-teal-400" />
          <h3 className="text-white font-bold text-lg group-hover:text-teal-400 transition">Ask AI Assistant</h3>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          Get personalized itineraries, hidden trails, packing suggestions, and real-time guidance based on your saved favorites!
        </p>
      </Link>
    </div>
  );
}
