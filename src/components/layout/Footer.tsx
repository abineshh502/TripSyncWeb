import React from "react";
import Link from "next/link";
import { Compass, Globe, MessageSquare, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/5 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2 text-xl font-bold text-white">
              <Compass className="h-6 w-6 text-teal-400" />
              <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">TripSync</span>
            </Link>
            <p className="text-sm">
              Sync your journeys, split your budgets, and navigate together with AI-powered itineraries.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#features" className="hover:text-white transition">Features</Link></li>
              <li><Link href="/#about" className="hover:text-white transition">AI Assistant</Link></li>
              <li><Link href="/#pricing" className="hover:text-white transition">Safety Map</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/" className="hover:text-white transition">Careers</Link></li>
              <li><Link href="/" className="hover:text-white transition">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Social</h4>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-white transition"><Globe className="h-5 w-5" /></a>
              <a href="#" className="hover:text-white transition"><MessageSquare className="h-5 w-5" /></a>
              <a href="#" className="hover:text-white transition"><Mail className="h-5 w-5" /></a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 mt-12 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} TripSync. All rights reserved. Cross-platform adventure companion.</p>
        </div>
      </div>
    </footer>
  );
}
