import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  basePath: process.env.NODE_ENV === 'production' ? '/wasm-compilers' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/wasm-compilers/' : '',
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
