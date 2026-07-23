"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useGroups } from "../../../hooks/useGroups";
import { Plus, Users, Compass, Key, Calendar, MapPin, IndianRupee } from "lucide-react";
import { formatDate, formatCurrency } from "../../../lib/utils";

export default function GroupsPage() {
  const router = useRouter();
  const { groups, loading, createGroup, joinGroup } = useGroups();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [groupName, setGroupName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !destination || !startDate || !endDate || !budget) return;

    await createGroup({
      groupName,
      destination,
      startDate,
      endDate,
      budget: Number(budget),
      description: description.trim(),
    });

    setGroupName("");
    setDestination("");
    setStartDate("");
    setEndDate("");
    setBudget("");
    setDescription("");
    setShowCreateModal(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) return;

    const joinedGroupId = await joinGroup(inviteCode);
    if (joinedGroupId) {
      setInviteCode("");
      setShowJoinModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Users className="h-7 w-7 text-teal-400" />
            <span>Group Buddies</span>
          </h1>
          <p className="text-slate-400 text-sm">Coordinate travel itineraries and bills with your fellow adventurers.</p>
        </div>
        <div className="flex space-x-3 w-full sm:w-auto">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
          >
            <Key className="h-4 w-4" />
            <span>Join Group</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 shadow-lg shadow-teal-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => router.push(`/groups/${group.id}`)}
              className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-teal-500/20 transition group cursor-pointer text-left"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white text-lg font-bold truncate group-hover:text-teal-400 transition">{group.groupName}</h3>
                    <p className="text-slate-500 text-xxs font-semibold">Organized by {group.organizer}</p>
                  </div>
                  <div className="bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md px-2 py-0.5 text-xxs font-mono shrink-0">
                    Code: {group.code}
                  </div>
                </div>

                {group.description && (
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{group.description}</p>
                )}

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center space-x-2 text-slate-300 text-xs">
                    <MapPin className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="truncate">{group.destination}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-300 text-xs">
                    <Calendar className="h-4 w-4 text-teal-400 shrink-0" />
                    <span>{formatDate(group.startDate)} - {formatDate(group.endDate)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-350 text-xs font-semibold">
                    <IndianRupee className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Shared Budget: {formatCurrency(group.budget)}</span>
                  </div>
                </div>
              </div>

              {group.members && group.members.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Buddies ({group.members.length}):</span>
                  <div className="flex -space-x-2 overflow-hidden">
                    {group.members.slice(0, 4).map((m: string, idx: number) => (
                      <div
                        key={idx}
                        className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-950 bg-teal-500 text-slate-950 text-center font-bold text-[10px] leading-6 select-none"
                        title={m}
                      >
                        {m.substring(0, 1).toUpperCase()}
                      </div>
                    ))}
                    {group.members.length > 4 && (
                      <div className="inline-block h-6 w-6 rounded-full ring-2 ring-slate-950 bg-slate-800 text-slate-400 text-center font-bold text-[9px] leading-6">
                        +{group.members.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel text-center p-12 border border-dashed border-white/10 rounded-2xl">
          <Users className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-white text-lg font-semibold">No group trips coordinated</h3>
          <p className="text-slate-550 text-sm mt-1 max-w-sm mx-auto">Create a group to invite friends, split dining bills, and align waypoints.</p>
          <div className="flex justify-center space-x-4 mt-6">
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Enter Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 text-teal-400 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Host Trip Group
            </button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold text-white">Host Group Journey</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Goa Beach Buddies"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Destination City</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Panaji"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Joint Budget Limit (₹)</label>
                <input
                  type="number"
                  required
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. 2500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Sharing stays and travel bills..."
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition active:scale-95"
                >
                  Host Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel max-w-sm w-full rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-xl font-bold text-white">Join Shared Trip</h2>
              <button onClick={() => setShowJoinModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Enter 6-Digit Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-center text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition text-lg font-mono tracking-widest uppercase"
                  placeholder="ABCDEF"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl py-2.5 text-sm transition active:scale-95"
                >
                  Join Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
