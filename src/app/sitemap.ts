import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { BASE_URL, canonical } from "@/lib/seo";

// Building the sitemap scans public content IDs without fetching every title from TMDB.
// Regenerate a few times daily rather than on every crawler visit.
export const revalidate = 21600;

type SitemapEntry = MetadataRoute.Sitemap[number];

function normalizeContentId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const match = trimmed.match(/(\d+)\s*$/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function addEntry(target: Map<string, SitemapEntry>, entry: SitemapEntry) {
  const existing = target.get(entry.url);
  if (!existing) {
    target.set(entry.url, entry);
    return;
  }

  const currentLastModified = existing.lastModified ? new Date(existing.lastModified) : null;
  const nextLastModified = entry.lastModified ? new Date(entry.lastModified) : null;

  if (
    nextLastModified &&
    (!currentLastModified || nextLastModified.getTime() > currentLastModified.getTime())
  ) {
    target.set(entry.url, { ...existing, lastModified: nextLastModified });
  }
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries = new Map<string, SitemapEntry>();

  const staticRoutes: SitemapEntry[] = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonical("/credits"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: canonical("/games"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: canonical("/privacy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: canonical("/terms"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  staticRoutes.forEach((entry) => addEntry(entries, entry));

  try {
    const adminDb = getFirebaseAdminDatabase();
    const [listsSnapshot, listItemsSnapshot, logsSnapshot] = await Promise.all([
      adminDb.ref("lists").get(),
      adminDb.ref("list_items").get(),
      adminDb.ref("movie_logs").get(),
    ]);

    const movieIds = new Set<number>();
    const tvIds = new Set<number>();

    const addContentRoute = (contentType: unknown, rawId: unknown) => {
      const contentId = normalizeContentId(rawId);
      if (!contentId) return;

      if (contentType === "tv") {
        tvIds.add(contentId);
        return;
      }

      if (contentType === "movie") {
        movieIds.add(contentId);
      }
    };

    if (logsSnapshot.exists()) {
      const logs = Object.values(logsSnapshot.val() as Record<string, any>);
      logs.forEach((log) => addContentRoute(log?.content_type, log?.content_id));
    }

    if (listItemsSnapshot.exists()) {
      const listItems = Object.values(listItemsSnapshot.val() as Record<string, any>);
      listItems.forEach((item) => addContentRoute(item?.content_type, item?.content_id));
    }

    if (listsSnapshot.exists()) {
      const lists = Object.entries(listsSnapshot.val() as Record<string, any>);
      lists.forEach(([listId, rawList]) => {
        if (!rawList || rawList.privacy !== "public") return;

        addEntry(entries, {
          url: canonical(`/lists/${listId}`),
          lastModified:
            normalizeDate(rawList.updated_at) ||
            normalizeDate(rawList.created_at) ||
            now,
          changeFrequency: "weekly",
          priority: 0.7,
          images: rawList.cover_image_url ? [rawList.cover_image_url] : undefined,
        });
      });
    }

    movieIds.forEach((movieId) => {
      addEntry(entries, {
        url: canonical(`/movie/${movieId}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    });

    tvIds.forEach((showId) => {
      addEntry(entries, {
        url: canonical(`/tv/${showId}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return Array.from(entries.values()).sort((a, b) => a.url.localeCompare(b.url));
}

const getCachedSitemap = unstable_cache(buildSitemap, ["public-sitemap-v2"], {
  revalidate: 21600,
});

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemap();
}
