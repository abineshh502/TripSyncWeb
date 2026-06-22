"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "TripSync solved our 10-person Goa budget arguments in 2 minutes. The Firebase sync between my laptop and everyone's phones worked flawlessly.",
    author: "Rohan Sharma",
    role: "Adventure Enthusiast",
    rating: 5,
  },
  {
    quote: "The AI safety index forecast is remarkably accurate. We modified our walking route in Manali based on the night safety score, and the recommendations were spot on.",
    author: "Neha Kapoor",
    role: "Solo Traveler",
    rating: 5,
  },
  {
    quote: "Solving the Traveling Salesperson routing locally in the browser saved us during a network drop in the valley. A masterclass in robust design.",
    author: "Amit Patel",
    role: "Backend Architect",
    rating: 5,
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-slate-950/45 border-t border-white/5 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            Loved by{" "}
            <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
              Modern Travelers
            </span>
          </h2>
          <p className="text-slate-400 text-base md:text-lg">
            See how groups and backpackers are optimizing their routes and coordinating budgets worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="glass-card p-8 rounded-2xl flex flex-col justify-between relative"
            >
              <div className="absolute top-6 right-6 text-slate-700">
                <Quote className="h-8 w-8 opacity-20" />
              </div>
              <div className="space-y-4">
                <div className="flex space-x-1">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-350 text-sm leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>
              <div className="border-t border-white/5 mt-6 pt-4">
                <div className="text-white font-semibold text-sm">{t.author}</div>
                <div className="text-slate-500 text-xs">{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
