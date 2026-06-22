"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { Compass, Menu, X, User as UserIcon, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
              <Compass className="h-6 w-6 text-teal-400 animate-spin-slow" />
              <span>TripSync</span>
            </Link>
            <div className="hidden md:flex ml-10 space-x-8">
              <Link href="/#features" className="text-sm font-medium text-slate-300 hover:text-white transition">Features</Link>
              <Link href="/#about" className="text-sm font-medium text-slate-300 hover:text-white transition">About</Link>
              <Link href="/#testimonials" className="text-sm font-medium text-slate-300 hover:text-white transition">Testimonials</Link>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-white transition bg-white/5 border border-white/10 rounded-full px-4 py-2 hover:bg-white/10"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="flex items-center space-x-1 text-sm font-medium text-rose-400 hover:text-rose-300 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition">
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 text-sm font-semibold rounded-full px-5 py-2.5 shadow-lg shadow-teal-500/20 hover:scale-[1.02] transition active:scale-95"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-400 hover:text-white p-2 rounded-md focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950 px-4 pt-2 pb-4 space-y-2">
          <Link
            href="/#features"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-white/5"
          >
            Features
          </Link>
          <Link
            href="/#about"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-white/5"
          >
            About
          </Link>
          <Link
            href="/#testimonials"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-white/5"
          >
            Testimonials
          </Link>
          <div className="border-t border-white/10 pt-4 flex flex-col space-y-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-2 text-base font-medium text-teal-400 px-3 py-2 rounded-md hover:bg-white/5"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  <span>Go to Dashboard</span>
                </Link>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="flex items-center space-x-2 text-base font-medium text-rose-400 px-3 py-2 rounded-md hover:bg-rose-500/10 text-left"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-center px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="block text-center bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-semibold rounded-md py-2.5 shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
