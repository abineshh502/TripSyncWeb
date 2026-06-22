import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../hooks/useAuth";
import QueryProvider from "../components/providers/QueryProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TripSync — AI Group Travel Planner",
  description: "Sync your journeys, split your budgets, and navigate together with AI-powered itineraries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950 scroll-smooth" data-scroll-behavior="smooth">
      <body className="font-sans min-h-full flex flex-col text-slate-100 bg-slate-950 antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster 
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#0f172a",
                  color: "#f1f5f9",
                  border: "1px solid rgba(255,255,255,0.08)",
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
