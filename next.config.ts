import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lrketeehpcgypljducau.supabase.co" },
    ],
    // Defaults skip a few widths (e.g. 800) that a `fill` + percentage
    // `sizes` image can legitimately compute on a high-DPR mobile viewport —
    // found live testing the landing page (400 "width not allowed").
    deviceSizes: [360, 414, 640, 750, 800, 828, 1080, 1200, 1600, 1920, 2048, 3840],
  },
};

export default nextConfig;
