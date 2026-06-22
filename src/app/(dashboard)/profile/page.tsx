"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { User as UserIcon, Mail, Bookmark, Save } from "lucide-react";
import { toast } from "react-hot-toast";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: name.trim(),
        bio: bio.trim(),
      });
      await refreshProfile();
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
          <UserIcon className="h-7 w-7 text-teal-400" />
          <span>Profile Profile</span>
        </h1>
        <p className="text-slate-400 text-sm">Update your public traveler handle, bio settings, and view email credentials.</p>
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 space-y-6">
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-2xl select-none">
              {profile?.name?.substring(0, 2).toUpperCase() || "TR"}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{profile?.name || "Traveler"}</h3>
              <p className="text-slate-500 text-xs">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <div>
              <label className="block text-xs font-medium text-slate-350 mb-1">Display Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-350 mb-1">Travel Bio</label>
              <div className="relative">
                <Bookmark className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-650 focus:outline-none focus:border-teal-500 transition text-sm"
                  placeholder="e.g. Backpacker, exploring South East Asia and beach fronts..."
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-650 hover:to-emerald-650 text-slate-950 font-semibold px-6 py-3 rounded-xl text-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-teal-500/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
