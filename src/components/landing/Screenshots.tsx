"use client";

import React from "react";
import { motion } from "framer-motion";
import { Smartphone, Monitor, ShieldCheck, Map, CreditCard } from "lucide-react";

export default function Screenshots() {
  return (
    <section id="about" className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1 text-sm font-medium text-teal-400">
              <Monitor className="h-4 w-4" />
              <span>Responsive Web Interface</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              One Shared Platform. <br />
              <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Every Device Synced.
              </span>
            </h2>
            <p className="text-slate-400 text-base md:text-lg leading-relaxed">
              Whether you are organizing from your computer at home, or reviewing coordinates on your phone at a busy crossroad, TripSync updates instantly.
            </p>
            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mt-1 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">Real-time DB Triggering</h4>
                  <p className="text-slate-400 text-xs">Shared Firestore structure syncs profiles, expense history, and route details immediately.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mt-1 shrink-0">
                  <Map className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">Offline Route Recovery</h4>
                  <p className="text-slate-400 text-xs">If connection is weak, the nearest-neighbor greedy route engine runs locally on the browser/device.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center items-center">
            {/* Background blur decorative circles */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-teal-500/5 blur-[80px]" />
            
            {/* Device Mockups (CSS Stacked) */}
            <div className="relative w-full max-w-[450px] aspect-[4/3] flex items-center justify-center">
              {/* Web Dashboard mockup */}
              <motion.div
                initial={{ opacity: 0, x: -30, rotate: -3 }}
                whileInView={{ opacity: 1, x: 0, rotate: -3 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="absolute w-[80%] aspect-[16/10] bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-3 space-y-3 left-2 z-10"
              >
                <div className="flex items-center space-x-1.5 border-b border-white/5 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span className="text-[9px] text-slate-500 ml-4 font-mono">tripsync.io/trips</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-lg h-10 border border-white/5" />
                  <div className="bg-white/5 rounded-lg h-10 border border-white/5" />
                  <div className="bg-white/5 rounded-lg h-10 border border-white/5" />
                </div>
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-2 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <div className="h-2 bg-teal-400/20 rounded w-2/3" />
                </div>
              </motion.div>

              {/* Mobile Phone Mockup */}
              <motion.div
                initial={{ opacity: 0, x: 35, y: 15, rotate: 6 }}
                whileInView={{ opacity: 1, x: 0, y: 15, rotate: 6 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="absolute right-4 w-[42%] aspect-[9/18] bg-slate-950 border border-white/15 rounded-[2rem] shadow-2xl p-2.5 z-20 overflow-hidden ring-4 ring-slate-800"
              >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-30" />
                {/* Phone screen content */}
                <div className="bg-slate-900 w-full h-full rounded-[1.7rem] overflow-hidden p-3 flex flex-col justify-between">
                  <div className="space-y-3 pt-3">
                    <div className="flex justify-between items-center text-[10px]">
                      <div className="h-3 bg-white/5 rounded w-1/3" />
                      <div className="w-3 h-3 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400">★</div>
                    </div>
                    <div className="h-16 bg-white/5 border border-white/5 rounded-xl p-2 space-y-2">
                      <div className="h-2.5 bg-white/10 rounded w-1/2" />
                      <div className="h-1.5 bg-white/5 rounded w-3/4" />
                      <div className="h-1.5 bg-white/5 rounded w-2/3" />
                    </div>
                    <div className="h-12 bg-white/5 border border-white/5 rounded-xl p-2 space-y-2">
                      <div className="h-2.5 bg-white/10 rounded w-2/3" />
                      <div className="h-1.5 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="bg-teal-500 py-1.5 rounded-lg text-slate-950 text-center font-bold text-[10px]">
                    Open Mobile App
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
