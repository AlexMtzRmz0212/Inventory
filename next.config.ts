import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: { root: path.resolve(import.meta.dirname) },
  // Keep the dev badge off the tray chips at the bottom-left.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
