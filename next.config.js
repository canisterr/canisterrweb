/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const stablePublicImages = ["cinema card.png", "review.png", "list.png", "STATS.png", "logo.png", "logo-ui.webp", "share.png", "log.png"];
    return stablePublicImages.map((asset) => ({
      source: `/${asset}`,
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
    }));
  },
  async rewrites() {
    return [
      // Keep Firebase's sign-in helper on Canisterr's domain so Google
      // doesn't expose the default firebaseapp.com auth host to users.
      {
        source: "/__/auth/:path*",
        destination: "https://filmshare-72c31.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://filmshare-72c31.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
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
