import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compress responses for faster transfer
  compress: true,
  // Tree-shake unused code more aggressively
  experimental: {
    optimizePackageImports: ["chart.js", "chartjs-plugin-zoom"],
  },
};

export default nextConfig;
