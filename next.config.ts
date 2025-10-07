import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Rewrite rules to proxy tools.jar from JavaFiddle CDN
  async rewrites() {
    return [
      {
        source: '/tools.jar',
        destination: 'https://javafiddle.leaningtech.com/tools.jar',
      },
    ];
  },
};

export default nextConfig;
