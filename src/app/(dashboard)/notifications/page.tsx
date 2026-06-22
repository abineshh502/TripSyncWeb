"use client";

import React, { useState } from "react";
import {
  Bell,
  Trash,
  Check,
  CloudRain,
  Users,
  Plane,
  Settings,
  ArrowRight,
  X,
  BellOff
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface TravelNotification {
  id: string;
  type: "weather" | "group" | "reminder" | "system";
  title: string;
  body: string;
  time: string;
  unread: boolean;
  route?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<TravelNotification[]>([
    {
      id: "1",
      type: "weather",
      title: "☔ Weather Warning: Goa",
      body: "Meteorological alert: Heavy rain showers forecast for the Palolem coastal region tomorrow. Reschedule beach activities & enjoy indoor cafes.",
      time: "2 hours ago",
      unread: true,
      route: "/explore",
    },
    {
      id: "2",
      type: "group",
      title: "💰 Split Cost Update",
      body: "Companion User #2 added an expense of ₹2,500 ('Boutique Stay Dinner') under Chennai Riders. Your split balance has been updated.",
      time: "5 hours ago",
      unread: true,
      route: "/groups",
    },
    {
      id: "3",
      type: "reminder",
      title: "✈️ Flight Departure Checklist",
      body: "Your upcoming Manali adventure is set to begin in 2 days! Check your active trip checklist, luggage limits, and sync offline maps.",
      time: "1 day ago",
      unread: false,
      route: "/trips",
    },
    {
      id: "4",
      type: "system",
      title: "🤖 AI Assistant Optimized",
      body: "TripSync AI has parsed your Favorite destinations and compiled a personalized travel guide trail. Tap to view suggestions in the chatbot assistant.",
      time: "3 days ago",
      unread: false,
      route: "/ai-assistant",
    },
  ]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success("All alerts marked as read");
  };

  const clearAll = () => {
    setNotifications([]);
    toast.success("Cleared all notifications");
  };

  const deleteOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification removed");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "weather":
        return <CloudRain className="h-5 w-5 text-rose-500" />;
      case "group":
        return <Users className="h-5 w-5 text-teal-400" />;
      case "reminder":
        return <Plane className="h-5 w-5 text-amber-500" />;
      default:
        return <Settings className="h-5 w-5 text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Bell className="h-7 w-7 text-teal-400" />
            <span>Notification Center 🔔</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Live travel alerts, split cost logs & reminders.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 text-rose-455 px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition active:scale-95"
          >
            <Trash className="h-4 w-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Sub action bar */}
      <div className="flex justify-between items-center py-3 border-y border-white/5 text-xs text-slate-500">
        <span>{notifications.length} Alerts available</span>
        {notifications.some((n) => n.unread) && (
          <button
            onClick={markAllRead}
            className="text-teal-400 hover:text-teal-350 font-bold flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative group ${
                item.unread
                  ? "bg-slate-900/60 border-teal-500/25"
                  : "bg-slate-900/30 border-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-full bg-slate-950/60 flex items-center justify-center border border-white/5 shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-bold flex items-center gap-2">
                      {item.title}
                      {item.unread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 block shrink-0" />
                      )}
                    </h3>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.time}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteOne(item.id, e)}
                  className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-slate-350 text-xs leading-relaxed pl-13">
                {item.body}
              </p>

              <div className="flex justify-between items-center border-t border-white/5 pt-3 pl-13">
                {item.route ? (
                  <Link
                    href={item.route}
                    className="inline-flex items-center text-xs font-bold text-teal-400 hover:text-teal-350"
                  >
                    <span>Resolve Now</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            </div>
          ))
        ) : (
          /* Empty State */
          <div className="glass-panel text-center p-16 border border-dashed border-white/10 rounded-2xl">
            <BellOff className="h-12 w-12 text-slate-605 mx-auto mb-4" />
            <h3 className="text-white text-xl font-bold mb-2">All Caught Up!</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              There are no pending alerts or split cost notifications at the moment. Keep exploring!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
