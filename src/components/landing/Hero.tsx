"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Compass, Sparkles, Map, Shield, Users } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-950 py-20">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm font-medium text-teal-400"
        >
          <Sparkles className="h-4 w-4 text-teal-400" />
          <span>Next-Generation Group Travel Companion</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-none"
        >
          Sync Journeys, Split Expenses, <br className="hidden md:inline" />
          <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Explore with AI
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-350 max-w-2xl mx-auto"
        >
          TripSync brings group coordination, live routing, expense splitting, and AI travel assistance together in a beautiful, cross-platform interface.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link
            href="/register"
            className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-full px-8 py-4 shadow-lg shadow-teal-500/20 hover:scale-[1.03] transition active:scale-97 text-center"
          >
            Start Planning Free
          </Link>
          <Link
            href="/#features"
            className="w-full sm:w-auto bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full px-8 py-4 transition text-center"
          >
            Explore Features
          </Link>
        </motion.div>

        {/* Floating dashboard mock widget */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pt-16 max-w-4xl mx-auto relative"
        >
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-slate-950/80 p-1 md:p-2">
            <div className="bg-slate-900/60 rounded-xl overflow-hidden aspect-[16/9] flex flex-col">
              {/* Fake window header */}
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 bg-slate-950/40">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="text-xs text-slate-500 font-mono">dashboard.tripsync.io</div>
                <div className="w-12" />
              </div>
              {/* Fake app layout */}
              <div className="flex-1 flex text-left text-xs text-slate-400 overflow-hidden">
                {/* Fake sidebar */}
                <div className="w-40 border-r border-white/5 bg-slate-950/20 p-4 space-y-4 hidden sm:block">
                  <div className="h-6 bg-white/5 rounded-md w-3/4" />
                  <div className="space-y-2 pt-2">
                    <div className="h-4 bg-teal-500/10 border border-teal-500/20 rounded-md w-full" />
                    <div className="h-4 bg-white/5 rounded-md w-5/6" />
                    <div className="h-4 bg-white/5 rounded-md w-4/5" />
                    <div className="h-4 bg-white/5 rounded-md w-2/3" />
                  </div>
                </div>
                {/* Fake content */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-white text-base font-bold">Goa Summer Adventure 🏖️</div>
                      <div className="text-slate-500 text-xxs">Active Group Trip • 4 Members</div>
                    </div>
                    <div className="bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full text-xxs border border-teal-500/30">Optimized</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-2">
                      <div className="text-slate-500 text-xxs font-semibold uppercase tracking-wider">Total Budget</div>
                      <div className="text-white text-sm font-bold">$1,200.00</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-2">
                      <div className="text-slate-500 text-xxs font-semibold uppercase tracking-wider">Safety Index</div>
                      <div className="text-teal-400 text-sm font-bold">8.6 / 10</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-2">
                      <div className="text-slate-500 text-xxs font-semibold uppercase tracking-wider">AI Route Status</div>
                      <div className="text-white text-sm font-bold">Optimal path</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-white font-bold text-xs">Itinerary Timeline</div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
                        <div>
                          <div className="text-white font-semibold text-xs">Stop 1: Baga Beach Beachwalk</div>
                          <div className="text-xxs text-slate-500">Morning sunrise stroll and local breakfast</div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5" />
                        <div>
                          <div className="text-white font-semibold text-xs">Stop 2: Aguada Fort Heritage Tour</div>
                          <div className="text-xxs text-slate-500">Historical sightseeing, lighthouse view</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
