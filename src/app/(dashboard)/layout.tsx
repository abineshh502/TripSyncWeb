"use client";

import React, { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import { Compass } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400">
        <Compass className="h-12 w-12 text-teal-400 animate-spin-slow mb-4" />
        <p className="text-sm font-semibold tracking-wide">Syncing data cache...</p>
      </div>
    );
  }

  if (!user) {
    return null; // or login redirecting screen
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-950/40 relative">
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 p-6 md:p-10 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
