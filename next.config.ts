import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // skips type errors
  },
  eslint: {
    ignoreDuringBuilds: true, // skips linting errors
  },
};

export default nextConfig;
