import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false
  },
  images: {
    // Serve catalog assets directly instead of routing every size through
    // Vercel's Image Optimization service.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "fortnite-api.com" },
      { protocol: "https", hostname: "cdn.fortnite-api.com" },
      { protocol: "https", hostname: "fnitem.shop" }
    ]
  },
  poweredByHeader: false
};

export default nextConfig;
