/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Dev-only workaround for Turbopack image cache issues with user avatars/data URLs.
    unoptimized: process.env.NODE_ENV === "development",
    formats: ["image/webp"],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.tvmaze.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/w160/**',
      },
    ],
  },
};

module.exports = nextConfig;
