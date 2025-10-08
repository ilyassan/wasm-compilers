import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/teavm/:path*',
        destination: 'https://teavm.org/playground/2/:path*',
      },
    ];
  },
};

export default nextConfig;
