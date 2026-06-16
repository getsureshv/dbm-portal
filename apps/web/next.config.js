/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so the app can run as a single self-contained Node server
  // for the public sandbox preview.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  // Proxy API calls to NestJS backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
