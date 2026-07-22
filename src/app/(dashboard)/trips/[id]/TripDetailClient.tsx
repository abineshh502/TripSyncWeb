"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../hooks/useAuth";
import {
  ArrowLeft,
  Calendar,
  IndianRupee,
  MapPin,
  Pencil,
  Trash2,
  Compass,
  FileText,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { formatDate, formatCurrency } from "../../../../lib/utils";

type TripStatus = "active" | "upcoming" | "completed";

const STATUS_CONFIG = {
  active: { label: "Active 🚀", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  upcoming: { label: "Upcoming 🗓", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25" },
  completed: { label: "Completed ✅", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/25" },
};

const getTripStatus = (trip: any): TripStatus => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = trip.startDate ? new Date(trip.startDate) : null;
  const end = trip.endDate ? new Date(trip.endDate) : null;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return "upcoming";
  end.setHours(23, 59, 59, 0);
  if (now > end) return "completed";
  if (now >= start) return "active";
  return "upcoming";
};

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!user || !params?.id) return;

    const unsubscribe = onSnapshot(
      doc(db, "trips", String(params.id)),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.userId && data.userId !== user.uid && !data.userIds?.includes(user.uid)) {
            toast.error("Permission denied");
            router.push("/trips");
            return;
          }
          setTrip({ id: snapshot.id, ...data });
        } else {
          setTrip(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params?.id, user, router]);

  const handleDelete = async () => {
    if (!trip?.id) return;
    try {
      await deleteDoc(doc(db, "trips", trip.id));
      toast.success("Trip deleted successfully");
      router.push("/trips");
    } catch {
      toast.error("Failed to delete trip");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="glass-panel text-center p-12 border border-white/5 rounded-2xl max-w-md mx-auto">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-white text-lg font-semibold">Trip Not Found</h3>
        <p className="text-slate-500 text-sm mt-1 mb-6">This journey profile could not be located or has been deleted.</p>
        <Link
          href="/trips"
          className="bg-teal-500/10 border border-teal-500/20 text-teal-400 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-500/20 transition"
        >
          Back to Journeys
        </Link>
      </div>
    );
  }

  const status = getTripStatus(trip);
  const statusCfg = STATUS_CONFIG[status];
  const daysList = trip.days || [];
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/trips"
            className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">{trip.tripName || trip.name}</h1>
            <p className="text-slate-400 text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-teal-400" />
              <span>{trip.destination}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => router.push(`/trips?edit=${trip.id}`)}
            className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-450 hover:bg-teal-500/20 transition"
          >
            <Pencil className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-455 hover:bg-rose-500/20 transition"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5 bg-gradient-to-br from-slate-900/40 via-slate-950/20 to-slate-900">
        <div className={`inline-flex items-center text-xs font-bold border rounded-full px-3 py-1 ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
          {statusCfg.label}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center items-center">
          <div className="space-y-1">
            <Calendar className="h-5 w-5 text-teal-400 mx-auto" />
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Start Date</p>
            <p className="text-white text-xs font-bold">{formatDate(trip.startDate)}</p>
          </div>
          <div className="w-px h-10 bg-white/5 mx-auto" />
          <div className="space-y-1">
            <Calendar className="h-5 w-5 text-teal-450 mx-auto" />
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">End Date</p>
            <p className="text-white text-xs font-bold">{formatDate(trip.endDate)}</p>
          </div>
          <div className="w-px h-10 bg-white/5 mx-auto" />
          <div className="space-y-1">
            <IndianRupee className="h-5 w-5 text-emerald-400 mx-auto" />
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Budget</p>
            <p className="text-white text-xs font-bold">{trip.budget ? formatCurrency(Number(trip.budget)) : "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-bold text-lg mb-6 flex items-center space-x-2">
          <Compass className="h-5 w-5 text-teal-400" />
          <span>Trip Timeline — {daysList.length} Days</span>
        </h3>

        {daysList.length > 0 ? (
          <div className="relative pl-8 border-l border-white/10 space-y-8 ml-4">
            {daysList.map((day: any, idx: number) => {
              const isToday = day.date === todayStr;
              return (
                <div key={idx} className="relative">
                  <div className={`absolute -left-12.5 top-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                    isToday
                      ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20"
                      : "bg-teal-500 text-slate-950"
                  }`}>
                    {day.dayNumber}
                  </div>

                  <div className={`glass-panel p-5 rounded-2xl border ${
                    isToday ? "border-emerald-500/40 bg-emerald-950/5" : "border-white/5"
                  } space-y-3`}>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-white text-sm font-bold flex items-center gap-2">
                          {day.title}
                          {isToday && (
                            <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md">
                              Today
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{day.date}</span>
                      </div>
                    </div>

                    {day.notes && (
                      <p className="text-slate-350 text-xs leading-relaxed italic bg-slate-900/40 p-3 border border-white/5 rounded-xl">
                        "{day.notes}"
                      </p>
                    )}

                    {day.destinations && day.destinations.length > 0 && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Places to visit:</span>
                        <div className="flex flex-wrap gap-2">
                          {day.destinations.map((dst: any, dIdx: number) => (
                            <span key={dIdx} className="inline-flex items-center text-xxs font-semibold bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-slate-300">
                              <MapPin className="h-3 w-3 text-teal-400 mr-1 shrink-0" />
                              {dst.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {day.mapLink && (
                      <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="font-mono">Route:</span>
                        <a
                          href={day.mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:underline hover:text-teal-350"
                        >
                          {day.mapLink}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel text-center p-12 border border-white/10 border-dashed rounded-2xl">
            <Calendar className="h-10 w-10 text-slate-650 mx-auto mb-4" />
            <h4 className="text-white text-base font-bold">No Timeline Days Planned</h4>
            <p className="text-slate-500 text-xs mt-1 mb-6">This trip does not have any day plans. Generate a day schedule by editing the trip details.</p>
            <button
              onClick={() => router.push(`/trips?edit=${trip.id}`)}
              className="bg-teal-500/10 border border-teal-500/20 text-teal-400 px-5 py-2 rounded-xl text-xs font-semibold hover:bg-teal-500/20 transition active:scale-95 flex items-center justify-center space-x-2 mx-auto"
            >
              <span>Add Day Plans</span>
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-sm w-full rounded-2xl border border-rose-500/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-450" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Delete Journey?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  This will permanently delete this trip and its entire timeline. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl py-2.5 text-sm transition active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
