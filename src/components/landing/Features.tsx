"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, MapPin, DollarSign, Shield, Compass, Share2 } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Travel Assistant",
    description: "Multi-turn context-aware chat to request custom spots, safety metrics, or weather tips in real-time.",
    color: "from-purple-500/20 to-indigo-500/20",
    iconColor: "text-indigo-400"
  },
  {
    icon: Compass,
    title: "Smart Route Optimization",
    description: "Automatically solves the Traveling Salesperson Problem (TSP) using a greedy algorithm to rank destination stops logically.",
    color: "from-teal-500/20 to-emerald-500/20",
    iconColor: "text-teal-400"
  },
  {
    icon: DollarSign,
    title: "Group Expense Splitter",
    description: "Easily log expenses, select who paid and who splits it, and track balance balances down to the penny.",
    color: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400"
  },
  {
    icon: Shield,
    title: "AI Safety & Crowd Indexes",
    description: "Provides overall safety scores, night-safety ratios, and traffic congestion data compiled dynamically with open weather integration.",
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400"
  },
  {
    icon: MapPin,
    title: "Interactive Interactive Maps",
    description: "Visual route lines linking stops. Integrates Leaflet maps for clean web rendering and OSRM direction mapping.",
    color: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400"
  },
  {
    icon: Share2,
    title: "Cross-Platform Syncing",
    description: "Real-time sync between Next.js web application and Expo Android application via Firestore triggers.",
    color: "from-rose-500/20 to-red-500/20",
    iconColor: "text-rose-400"
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-slate-950/50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
              Travel Together
            </span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            Say goodbye to endless group chat threads, messy spreadsheets, and complicated routing systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-card p-8 rounded-2xl relative overflow-hidden group"
              >
                {/* Background glow decoration */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
                <div className="relative z-10 space-y-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${feature.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-white text-xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
