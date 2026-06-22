"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { CheckCircle, Plus, Trash, BookOpen, Edit2, Check, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function VisitedPage() {
  const { user } = useAuth();
  const [visited, setVisited] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memoryText, setMemoryText] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "visited"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const temp: any[] = [];
        snapshot.forEach((docSnap) => {
          temp.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Sort by visitedAt descending
        temp.sort((a, b) => {
          const aTime = a.visitedAt?.toMillis?.() || a.visitedAt?.seconds * 1000 || new Date(a.visitedAt).getTime() || 0;
          const bTime = b.visitedAt?.toMillis?.() || b.visitedAt?.seconds * 1000 || new Date(b.visitedAt).getTime() || 0;
          return bTime - aTime;
        });
        setVisited(temp);
        setLoading(false);
      },
      (error) => {
        console.error("Visited fetch error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const saveMemory = async (id: string) => {
    try {
      await updateDoc(doc(db, "visited", id), {
        memories: memoryText,
      });
      setEditingId(null);
      setMemoryText("");
      toast.success("Travel memory saved successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Could not save your memory log");
    }
  };

  const removeVisited = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, "visited", id));
      toast.success(`Removed "${name}" from visited ledger`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete log");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <CheckCircle className="h-7 w-7 text-teal-400" />
          <span>Visited Places ✅</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Track your travel memories, milestones & adventures across the globe.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visited.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visited.map((item, idx) => (
            <div
              key={item.id || idx}
              className="glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between hover:shadow-lg hover:shadow-teal-500/5 transition-all group bg-gradient-to-br from-slate-900/40 via-slate-950/20 to-slate-900"
            >
              <div>
                <img
                  src={item.image || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e"}
                  alt={item.name}
                  className="w-full h-40 object-cover border-b border-white/5"
                />
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-white text-base font-bold truncate group-hover:text-teal-400 transition">
                      {item.name}
                    </h3>
                    <button
                      onClick={() => removeVisited(item.id, item.name)}
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-slate-400 text-xs truncate">📍 {item.address || "Completed Journey"}</p>

                  {item.category && (
                    <span className="inline-flex items-center text-[10px] font-semibold text-teal-400 bg-teal-500/10 border border-teal-550/20 rounded-md px-2 py-0.5">
                      {item.category}
                    </span>
                  )}

                  {/* Memories log box */}
                  <div className="bg-slate-950/60 border border-white/5 p-3.5 rounded-xl space-y-2">
                    <div className="text-[10px] font-bold text-yellow-500 tracking-wider uppercase flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      <span>My Memory Log</span>
                    </div>

                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={memoryText}
                          onChange={(e) => setMemoryText(e.target.value)}
                          placeholder="Write down memories from your visit..."
                          className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-xs resize-none"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded-md text-xxs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/5"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveMemory(item.id)}
                            className="px-2.5 py-1 rounded-md text-xxs font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-slate-300 text-xs italic leading-relaxed">
                          {item.memories ? `"${item.memories}"` : "No memories logged yet. Tap edit to log your stories!"}
                        </p>
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setMemoryText(item.memories || "");
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-teal-400 hover:underline hover:text-teal-350 self-end ml-auto"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                          <span>Edit Log</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-panel text-center p-16 border border-dashed border-white/10 rounded-2xl">
          <CheckCircle className="h-12 w-12 text-slate-650 mx-auto mb-4" />
          <h3 className="text-white text-xl font-bold mb-2">No Visited Places Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
            Keep traveling, complete journeys, and write down your stories to unlock lifetime achievements!
          </p>
          <Link
            href="/explore"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-6 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 inline-block"
          >
            Start Exploring
          </Link>
        </div>
      )}

      {/* AI Travel Story prompt */}
      <Link
        href="/ai-assistant"
        onClick={() => {
          toast.success("AI story generator prompt loaded into AI Chat!");
        }}
        className="block bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 rounded-2xl p-6 hover:scale-[1.01] transition shadow-xl"
      >
        <div className="flex items-center space-x-2.5 mb-2">
          <Sparkles className="h-5 w-5 fill-slate-950 text-slate-950" />
          <h3 className="font-bold text-lg">AI Travel Story</h3>
        </div>
        <p className="text-slate-900 text-sm leading-relaxed font-medium">
          Create customized, high-definition novelized summaries of your global milestones and post them directly to social boards. (Available in chatbot assistant!)
        </p>
      </Link>
    </div>
  );
}
