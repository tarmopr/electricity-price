import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/elering/:path*',
        destination: 'https://dashboard.elering.ee/api/:path*',
      },
    ];
  },
};

export default nextConfig;
