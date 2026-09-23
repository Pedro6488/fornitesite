import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "fortnite-api.com" },
      { protocol: "https", hostname: "cdn.fortnite-api.com" },
      { protocol: "https", hostname: "fnitem.shop" }
    ]
  },
  poweredByHeader: false
};

export default nextConfig;
