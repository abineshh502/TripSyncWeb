"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { 
  Compass, 
  LayoutDashboard, 
  Map, 
  Sparkles, 
  MessageSquare, 
  ShieldAlert, 
  Navigation, 
  CreditCard, 
  Share2, 
  Heart, 
  CheckCircle, 
  Users, 
  User as UserIcon,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/trips", label: "My Trips", icon: Map },
  { href: "/ai-planner", label: "AI Planner", icon: Sparkles },
  { href: "/ai-assistant", label: "AI Assistant", icon: MessageSquare },
  { href: "/safety", label: "Safety Map", icon: ShieldAlert },
  { href: "/routes", label: "Optimized Routes", icon: Navigation },
  { href: "/expenses", label: "Group Expenses", icon: CreditCard },
  { href: "/route-sharing", label: "Route Sharing", icon: Share2 },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/visited", label: "Visited places", icon: CheckCircle },
  { href: "/groups", label: "Group Buddies", icon: Users },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();

  return (
    <aside className="w-64 border-r border-white/10 bg-slate-950/80 backdrop-blur-md text-slate-350 flex flex-col justify-between shrink-0">
      <div className="flex-1 py-6 flex flex-col overflow-y-auto">
        {/* Header Branding */}
        <div className="px-6 pb-6 border-b border-white/5">
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            <Compass className="h-6 w-6 text-teal-400 animate-spin-slow" />
            <span>TripSync</span>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="px-3 pt-6 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150",
                  isActive 
                    ? "bg-teal-500/10 border border-teal-500/20 text-teal-400" 
                    : "hover:bg-white/5 hover:text-white border border-transparent"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-teal-400" : "text-slate-400 group-hover:text-slate-300")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile section footer */}
      <div className="border-t border-white/5 p-4 space-y-3 bg-slate-950/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
            {profile?.name?.substring(0, 2).toUpperCase() || "TR"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{profile?.name || "Traveler"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/5 hover:text-rose-300 border border-transparent transition duration-150 text-left"
        >
          <LogOut className="h-5 w-5 text-rose-400" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
