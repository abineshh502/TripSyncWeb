"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrips } from "../../../hooks/useTrips";
import {
  Plus, Trash, Calendar, MapPin, IndianRupee, FileText,
  Pencil, Copy, Share2, X, Check, MoreVertical, Loader2, Navigation
} from "lucide-react";
import { formatDate, formatCurrency } from "../../../lib/utils";
import { Trip } from "../../../types";
import { toast } from "react-hot-toast";

const TRANSPORT_TYPES = ["Flight", "Train", "Bus", "Car", "Bike", "Cruise", "Mixed"];

const tripColorClasses = [
  "from-teal-500/10 to-emerald-500/10 border-teal-500/20",
  "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
  "from-violet-500/10 to-purple-500/10 border-violet-500/20",
  "from-amber-500/10 to-orange-500/10 border-amber-500/20",
  "from-rose-500/10 to-pink-500/10 border-rose-500/20",
];

function TripFormModal({
  trip,
  onClose,
  onSave,
  isEditing,
}: {
  trip?: Trip;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isEditing: boolean;
}) {
  const [name, setName] = useState(trip?.name || "");
  const [destination, setDestination] = useState(trip?.destination || "");
  const [startDate, setStartDate] = useState(trip?.startDate || "");
  const [endDate, setEndDate] = useState(trip?.endDate || "");
  const [budget, setBudget] = useState(trip?.budget?.toString() || "");
  const [description, setDescription] = useState(trip?.description || "");
  const [travelPreferences, setTravelPreferences] = useState(trip?.travelPreferences || "");
  const [notes, setNotes] = useState(trip?.notes || "");
  const [transportationType, setTransportationType] = useState(trip?.transportationType || "");
  const [saving, setSaving] = useState(false);

  // Day itinerary planner states
  const [days, setDays] = useState<any[]>(trip?.days || []);
  const [daysGenerated, setDaysGenerated] = useState(trip?.days ? trip.days.length > 0 : false);

  const generateDays = () => {
    if (!startDate || !endDate) {
      toast.error("Please enter start and end dates first");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      toast.error("Invalid date format");
      return;
    }
    if (end < start) {
      toast.error("End date must be after start date");
      return;
    }
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayCount > 30) {
      toast.error("Trip duration cannot exceed 30 days");
      return;
    }

    const generated: any[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const existing = days.find((day) => day.dayNumber === i + 1);
      generated.push(
        existing || {
          dayNumber: i + 1,
          date: d.toISOString().split("T")[0],
          title: i === 0 ? "Day 1 - Arrival & Check-in" : (i === dayCount - 1 ? `Day ${i + 1} - Departure` : `Day ${i + 1} - Exploration`),
          notes: "",
          destinations: [],
          mapLink: "",
        }
      );
    }
    setDays(generated);
    setDaysGenerated(true);
    toast.success(`Generated ${dayCount} itinerary day schedules`);
  };

  const addDestination = (dayIndex: number) => {
    const updated = [...days];
    updated[dayIndex].destinations = [...(updated[dayIndex].destinations || []), { name: "" }];
    setDays(updated);
  };

  const updateDestination = (dayIndex: number, destIndex: number, value: string) => {
    const updated = [...days];
    updated[dayIndex].destinations[destIndex].name = value;
    setDays(updated);
  };

  const removeDestination = (dayIndex: number, destIndex: number) => {
    const updated = [...days];
    updated[dayIndex].destinations = updated[dayIndex].destinations.filter((_: any, idx: number) => idx !== destIndex);
    setDays(updated);
  };

  const updateDayField = (dayIndex: number, field: string, value: string) => {
    const updated = [...days];
    updated[dayIndex][field] = value;
    setDays(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !destination.trim() || !startDate || !endDate) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      tripName: name.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      budget: budget ? Number(budget) : undefined,
      description: description.trim() || undefined,
      travelPreferences: travelPreferences.trim() || undefined,
      notes: notes.trim() || undefined,
      transportationType: transportationType || undefined,
      days,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel max-w-lg w-full rounded-2xl border border-white/10 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <h2 className="text-xl font-bold text-white">{isEditing ? "Edit Journey" : "Create Journey"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Destination */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Trip Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm"
                placeholder="e.g. Goa Beach Adventure"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Destination City *</label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm"
                placeholder="e.g. Panaji, Goa"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date *</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
              />
            </div>
          </div>

          {/* Budget & Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Budget Limit (₹)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm"
                placeholder="e.g. 25000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Transport Type</label>
              <select
                value={transportationType}
                onChange={(e) => setTransportationType(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
              >
                <option value="">— Select —</option>
                {TRANSPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Travel Preferences */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Travel Preferences</label>
            <input
              type="text"
              value={travelPreferences}
              onChange={(e) => setTravelPreferences(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm"
              placeholder="e.g. Adventure, Beaches, Local food"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm resize-none"
              placeholder="Brief overview of the trip plan..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Private Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-sm resize-none"
              placeholder="Packing lists, reminders, visa requirements..."
            />
          </div>

          {/* Day Planner Itinerary Schedule builder */}
          <div className="border-t border-white/5 pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-400" />
                <span>Day-by-Day Planner</span>
              </h3>
              <button
                type="button"
                onClick={generateDays}
                className="text-xs font-semibold text-teal-400 hover:text-teal-350 hover:underline"
              >
                {daysGenerated ? `Regenerate Schedule (${days.length} days)` : "Generate Day Schedule"}
              </button>
            </div>

            {daysGenerated && days.length > 0 && (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {days.map((day, dayIndex) => (
                  <div key={dayIndex} className="bg-slate-950/40 p-4 border border-white/5 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="bg-teal-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                        Day {day.dayNumber}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{day.date}</span>
                    </div>

                    <input
                      type="text"
                      value={day.title || ""}
                      onChange={(e) => updateDayField(dayIndex, "title", e.target.value)}
                      placeholder="Day Title (e.g. Arrival & Check-in)"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 transition text-xs font-semibold"
                    />

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Notes</label>
                      <textarea
                        rows={2}
                        value={day.notes || ""}
                        onChange={(e) => updateDayField(dayIndex, "notes", e.target.value)}
                        placeholder="Plans, notes, reminders..."
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 transition text-xs resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Places to visit</label>
                      {(day.destinations || []).map((dest: any, destIdx: number) => (
                        <div key={destIdx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={dest.name || ""}
                            onChange={(e) => updateDestination(dayIndex, destIdx, e.target.value)}
                            placeholder={`Place ${destIdx + 1}`}
                            className="flex-1 bg-slate-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 transition text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => removeDestination(dayIndex, destIdx)}
                            className="text-rose-400 hover:text-rose-350 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addDestination(dayIndex)}
                        className="text-[10px] font-bold text-teal-400 hover:underline flex items-center gap-1"
                      >
                        + Add Place
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Route/Map Link</label>
                      <input
                        type="text"
                        value={day.mapLink || ""}
                        onChange={(e) => updateDayField(dayIndex, "mapLink", e.target.value)}
                        placeholder="Paste route link..."
                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-teal-500 transition text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl py-2.5 text-sm transition active:scale-95 disabled:opacity-60 flex items-center justify-center space-x-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>{isEditing ? "Save Changes" : "Create Journey"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TripsPage() {
  const router = useRouter();
  const { trips, loading, createTrip, updateTrip, deleteTrip, duplicateTrip, shareTripRoute } = useTrips();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [sharingTripId, setSharingTripId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Auto edit launch from parameter redirection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const editId = searchParams.get("edit");
      if (editId && trips.length > 0) {
        const match = trips.find((t) => t.id === editId);
        if (match) {
          setEditingTrip(match);
          // clear search query params
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    }
  }, [trips]);

  const handleCreate = async (data: Omit<Trip, "id" | "userIds" | "createdAt" | "spots">) => {
    await createTrip(data);
    setShowCreateModal(false);
  };

  const handleUpdate = async (data: Omit<Trip, "id" | "userIds" | "createdAt" | "spots">) => {
    if (!editingTrip?.id) return;
    await updateTrip(editingTrip.id, data);
    setEditingTrip(null);
  };

  const handleDelete = async () => {
    if (!deletingTripId) return;
    await deleteTrip(deletingTripId);
    setDeletingTripId(null);
  };

  const handleDuplicate = async (trip: Trip) => {
    setOpenMenuId(null);
    await duplicateTrip(trip);
  };

  const handleShare = async (trip: Trip) => {
    setOpenMenuId(null);
    setSharingTripId(trip.id || null);
    await shareTripRoute(trip);
    setSharingTripId(null);
  };

  const getDuration = (start: string, end: string) => {
    try {
      const diff = new Date(end).getTime() - new Date(start).getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : null;
    } catch { return null; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Journeys 🗺️</h1>
          <p className="text-slate-400 text-sm mt-1">
            {trips.length > 0
              ? `${trips.length} trip${trips.length !== 1 ? "s" : ""} planned — manage, edit, and optimize your travels.`
              : "Create and organize your itineraries and travel budgets."}
          </p>
        </div>
        <button
          id="btn-new-journey"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-4 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 shadow-lg shadow-teal-500/15"
        >
          <Plus className="h-4 w-4" />
          <span>New Journey</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip, colorIdx) => {
            const gradClass = tripColorClasses[colorIdx % tripColorClasses.length];
            const duration = getDuration(trip.startDate, trip.endDate);
            const isSharing = sharingTripId === trip.id;
            return (
              <div
                key={trip.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.menu-container') || target.closest('button')) return;
                  router.push(`/trips/${trip.id}`);
                }}
                className={`glass-panel rounded-2xl border overflow-hidden flex flex-col justify-between hover:shadow-lg hover:shadow-teal-500/5 transition-all group bg-gradient-to-br ${gradClass} cursor-pointer`}
              >
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-base font-bold truncate group-hover:text-teal-300 transition">
                        {trip.name}
                      </h3>
                      {trip.transportationType && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 mt-1">
                          <Navigation className="h-2.5 w-2.5 mr-1" />
                          {trip.transportationType}
                        </span>
                      )}
                    </div>
                    {/* Action menu */}
                    <div className="relative shrink-0 menu-container">
                      <button
                        id={`menu-${trip.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === trip.id ? null : (trip.id || null));
                        }}
                        className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === trip.id && (
                        <div className="absolute right-0 top-8 z-30 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[160px] space-y-0.5">
                          <button
                            id={`edit-${trip.id}`}
                            onClick={(e) => { e.stopPropagation(); setEditingTrip(trip); setOpenMenuId(null); }}
                            className="w-full flex items-center space-x-2 text-left text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-xs font-medium transition"
                          >
                            <Pencil className="h-3.5 w-3.5 text-teal-400" />
                            <span>Edit Journey</span>
                          </button>
                          <button
                            id={`duplicate-${trip.id}`}
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(trip); }}
                            className="w-full flex items-center space-x-2 text-left text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-xs font-medium transition"
                          >
                            <Copy className="h-3.5 w-3.5 text-blue-400" />
                            <span>Duplicate</span>
                          </button>
                          <button
                            id={`share-${trip.id}`}
                            onClick={(e) => { e.stopPropagation(); handleShare(trip); }}
                            disabled={isSharing}
                            className="w-full flex items-center space-x-2 text-left text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-50"
                          >
                            {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> : <Share2 className="h-3.5 w-3.5 text-emerald-400" />}
                            <span>Share Route</span>
                          </button>
                          <div className="border-t border-white/5 my-1" />
                          <button
                            id={`delete-${trip.id}`}
                            onClick={(e) => { e.stopPropagation(); setDeletingTripId(trip.id || null); setOpenMenuId(null); }}
                            className="w-full flex items-center space-x-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 px-3 py-2 rounded-lg text-xs font-medium transition"
                          >
                            <Trash className="h-3.5 w-3.5" />
                            <span>Delete Trip</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {trip.description && (
                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{trip.description}</p>
                  )}

                  {/* Meta info */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-slate-300 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                      <span className="truncate">{trip.destination}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-300 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                      <span>{formatDate(trip.startDate)} → {formatDate(trip.endDate)}</span>
                      {duration && (
                        <span className="text-slate-500">({duration})</span>
                      )}
                    </div>
                    {trip.budget && (
                      <div className="flex items-center space-x-2 text-slate-300 text-xs font-semibold">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300">Budget: {formatCurrency(trip.budget)}</span>
                      </div>
                    )}
                  </div>

                  {/* Preferences & Notes badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {trip.travelPreferences && (
                      <span className="text-[10px] text-slate-400 bg-slate-800/60 border border-white/5 rounded-full px-2 py-0.5">
                        ✨ {trip.travelPreferences.split(",")[0].trim()}
                      </span>
                    )}
                    {trip.notes && (
                      <span className="text-[10px] text-slate-400 bg-slate-800/60 border border-white/5 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <FileText className="h-2.5 w-2.5" />
                        Has notes
                      </span>
                    )}
                  </div>
                </div>

                {/* Spots Timeline */}
                {trip.spots && trip.spots.length > 0 && (
                  <div className="bg-slate-950/40 border-t border-white/5 px-5 py-3">
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1.5">
                      {trip.spots.length} Stop{trip.spots.length !== 1 ? "s" : ""} Mapped
                    </span>
                    <div className="text-xs text-slate-400 truncate">
                      {trip.spots.map((s) => s.name).join(" → ")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel text-center p-16 border border-dashed border-white/10 rounded-2xl">
          <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-white text-xl font-bold mb-2">No journeys planned yet</h3>
          <p className="text-slate-550 text-sm max-w-sm mx-auto mb-6">
            Create your first journey to structure destinations, plan itineraries, and get AI-optimized routes.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-6 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
          >
            Create First Journey
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <TripFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          isEditing={false}
        />
      )}

      {/* Edit Modal */}
      {editingTrip && (
        <TripFormModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSave={handleUpdate}
          isEditing={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-sm w-full rounded-2xl border border-rose-500/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash className="h-5 w-5 text-rose-450" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Delete Journey?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  This will permanently delete the trip and all its waypoints. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeletingTripId(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-trip"
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
