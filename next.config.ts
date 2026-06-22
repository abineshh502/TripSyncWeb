import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Bypass Next.js WASM TypeScript checker crash on Windows (invalid usize bug).
    // Real type-checking is verified separately via `npx tsc --noEmit`.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // the project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://tripsyncbackend-production-37a2.up.railway.app https://tripsyncweb-backend.onrender.com https://api.geoapify.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://*.firebaseio.com https://*.googleapis.com https://*.firebase.com; frame-src 'self' https://*.firebaseapp.com https://*.google.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
