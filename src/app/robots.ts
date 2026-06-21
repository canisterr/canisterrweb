import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/movie/",
          "/tv/",
          "/log/",
          "/lists/",
          "/privacy",
          "/terms",
          "/credits",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/posts/",
          "/profile/",
          "/user/",
          "/lists",
          "/profile/edit",
          "/profile/settings/",
          "/notifications",
          "/scan",
          "/share",
          "/taste",
          "/logs/",
          "/movie-matcher",
          "/friends",
          "/all-movies",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
