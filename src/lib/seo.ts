import type { Metadata } from "next";

export const BASE_URL = "https://canisterr.com";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const DEFAULT_OG_IMAGE = `${BASE_URL}/logo.png`;
const DEFAULT_SITE_TITLE = "Canisterr - Your Cinema Identity";
const DEFAULT_SITE_DESCRIPTION =
  "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.";

function resolveImageUrl(
  path: string | null | undefined,
  size: "w300" | "w500" | "w780" | "original" = "w780"
): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return tmdbImage(path, size);
}

function getGenreKeywords(
  genres: Array<{ name: string }> | string[] | null | undefined
): string[] {
  if (!Array.isArray(genres)) return [];
  return genres
    .map((genre) =>
      typeof genre === "string" ? genre.toLowerCase() : genre?.name?.toLowerCase() || ""
    )
    .filter(Boolean);
}

// Converts any string into a URL-safe slug.
// "The Dark Knight" → "the-dark-knight"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Builds a full canonical URL.
export function canonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

// Builds a TMDB image URL at the requested size.
// size: "w300" | "w500" | "w780" | "original"
export function tmdbImage(path: string | null | undefined, size = "w780"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Base Open Graph + Twitter metadata shared by all pages.
export function baseMetadata(overrides: Partial<Metadata> = {}): Metadata {
  const googleSiteVerification =
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    "";

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: DEFAULT_SITE_TITLE,
      template: "%s | Canisterr",
    },
    description: DEFAULT_SITE_DESCRIPTION,
    keywords: [
      "movies",
      "film",
      "movie reviews",
      "discover movies through friends",
      "social movie platform",
      "movie tracker",
      "tv shows",
      "film diary",
      "canisterr",
    ],
    authors: [{ name: "Canisterr" }],
    creator: "Canisterr",
    openGraph: {
      siteName: "Canisterr",
      locale: "en_US",
      type: "website",
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      url: BASE_URL,
      images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: "Canisterr" }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@canisterr",
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: googleSiteVerification
      ? {
          google: googleSiteVerification,
        }
      : undefined,
    ...overrides,
  };
}

// Metadata for a movie page — call with raw TMDB response.
export function movieMetadata(movie: {
  id: number;
  title: string;
  overview: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  poster_url?: string | null;
  backdrop_path?: string | null;
  backdrop_url?: string | null;
  genres?: Array<{ name: string }> | string[];
}, canonicalPath: string = `/movie/${movie.id}`): Metadata {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const title = year ? `${movie.title} (${year})` : movie.title;
  const description = movie.overview
    ? movie.overview.slice(0, 155)
    : `See reviews, ratings, and logs for ${movie.title} on Canisterr.`;

  const ogImage = resolveImageUrl(movie.backdrop_path ?? movie.backdrop_url ?? movie.poster_path ?? movie.poster_url, "w780");
  const posterImage = resolveImageUrl(movie.poster_path ?? movie.poster_url, "w500");
  const genreKeywords = getGenreKeywords(movie.genres);

  return baseMetadata({
    title,
    description,
    keywords: ["movie", movie.title, ...(year ? [String(year)] : []), ...genreKeywords],
    alternates: { canonical: canonical(canonicalPath) },
    openGraph: {
      type: "website",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(canonicalPath),
      title,
      description,
      images: ogImage
        ? [{ url: ogImage, width: 780, height: 439, alt: title }]
        : posterImage
          ? [{ url: posterImage, width: 500, height: 750, alt: title }]
          : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : posterImage ? [posterImage] : undefined,
    },
  });
}

// Metadata for a TV show page — call with raw TVMaze response.
export function tvMetadata(show: {
  id: number;
  name: string;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
  poster_url?: string | null;
  premiered?: string | null;
  release_date?: string | null;
  overview?: string | null;
  genres?: string[];
  language?: string | null;
}, canonicalPath: string = `/tv/${show.id}`): Metadata {
  const releaseDate = show.premiered || show.release_date || null;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const title = year ? `${show.name} (${year})` : show.name;
  // TVMaze summary includes HTML tags — strip them.
  const summary = show.summary || show.overview || "";
  const description = summary
    ? summary.replace(/<[^>]+>/g, "").slice(0, 155)
    : `See reviews and logs for ${show.name} on Canisterr.`;
  const image = show.image?.original ?? show.image?.medium ?? show.poster_url ?? null;

  return baseMetadata({
    title,
    description,
    keywords: [
      "tv show",
      show.name,
      ...(year ? [String(year)] : []),
      ...(show.genres ?? []),
      ...(show.language ? [show.language] : []),
    ],
    alternates: { canonical: canonical(canonicalPath) },
    openGraph: {
      type: "website",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(canonicalPath),
      title,
      description,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  });
}

// Metadata for a user profile page.
export function profileMetadata(username: string, displayName?: string | null, bio?: string | null): Metadata {
  const name = displayName || `@${username}`;
  const title = `${name}'s Profile`;
  const description = bio
    ? bio.slice(0, 155)
    : `See ${name}'s movie logs, reviews, and lists on Canisterr.`;
  const path = `/profile/${username}`;

  return baseMetadata({
    title,
    description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "profile",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(path),
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  });
}

export function crewMetadata(person: {
  id: number;
  name: string;
  biography?: string | null;
  knownDepartment?: string | null;
  profileImageUrl?: string | null;
}): Metadata {
  const title = `${person.name} Filmography, Roles & Career Timeline | Canisterr`;
  const description = `Explore ${person.name}'s movies, TV shows, acting roles, directing credits, writing credits, music work, and full career timeline on Canisterr.`;
  const slug = slugify(person.name) || "person";
  const path = `/crew/${person.id}-${slug}`;

  return baseMetadata({
    title,
    description,
    keywords: ["crew", "filmography", person.name, person.knownDepartment || "movies", "tv shows", "career timeline"],
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "profile",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(path),
      title,
      description,
      images: person.profileImageUrl ? [{ url: person.profileImageUrl, alt: person.name }] : undefined,
    },
    twitter: {
      card: person.profileImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: person.profileImageUrl ? [person.profileImageUrl] : undefined,
    },
  });
}

// JSON-LD schema builders

export function movieSchema(movie: {
  id: number;
  title: string;
  overview?: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  poster_url?: string | null;
  runtime?: number | null;
  genres?: Array<{ name: string }> | string[];
}, canonicalPath: string = `/movie/${movie.id}`) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    description: movie.overview ?? undefined,
    datePublished: movie.release_date ?? undefined,
    image: resolveImageUrl(movie.poster_path ?? movie.poster_url, "w500") ?? undefined,
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
    genre: Array.isArray(movie.genres)
      ? movie.genres.map((genre) => (typeof genre === "string" ? genre : genre.name))
      : [],
    url: canonical(canonicalPath),
  };
}

export function tvSchema(show: {
  id: number;
  name: string;
  summary?: string | null;
  overview?: string | null;
  premiered?: string | null;
  release_date?: string | null;
  image?: { original?: string; medium?: string } | null;
  poster_url?: string | null;
  genres?: string[];
}, canonicalPath: string = `/tv/${show.id}`) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    description: (show.summary || show.overview)?.replace(/<[^>]+>/g, "") ?? undefined,
    startDate: show.premiered || show.release_date || undefined,
    image: show.image?.original ?? show.image?.medium ?? show.poster_url ?? undefined,
    genre: show.genres ?? [],
    url: canonical(canonicalPath),
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Canisterr",
    url: BASE_URL,
    description: DEFAULT_SITE_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: "Canisterr",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE,
      },
    },
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Canisterr",
    url: BASE_URL,
    logo: DEFAULT_OG_IMAGE,
    description: DEFAULT_SITE_DESCRIPTION,
  };
}

// ─── Log / review helpers ────────────────────────────────────────────────────

// Parses a movie slug like "inception-2010--christopher-nolan--en" → { titleHint: "inception", year: 2010 }
export function parseMovieSlug(slug: string): { titleHint: string; year: number | null } {
  const [titleSegment] = decodeURIComponent(slug).split("--");
  const parts = titleSegment.split("-").filter(Boolean);
  const yearIndex = parts.findIndex((part) => /^\d{4}$/.test(part));
  const year = yearIndex >= 0 ? parseInt(parts[yearIndex], 10) : null;
  const titleHint = (yearIndex >= 0 ? parts.slice(0, yearIndex) : parts).join(" ").trim();
  return { titleHint, year };
}

// reaction value → human label → schema.org ratingValue (1–5)
export function reactionToRating(reaction: number | null | undefined): {
  label: string;
  value: number;
} {
  if (reaction === 2) return { label: "Masterpiece", value: 5 };
  if (reaction === 1) return { label: "Good", value: 4 };
  if (reaction === 1.5) return { label: "Average", value: 3 };
  if (reaction === 0) return { label: "Bad", value: 1 };
  return { label: "Unrated", value: 0 };
}

// Metadata for a log page. isPublic=false adds noindex/nofollow.
export function logMetadata(params: {
  username: string;
  movieTitle: string;
  year: number | null;
  slug: string;
  ratingLabel?: string | null;
  review?: string | null;
  posterUrl?: string | null;
  isPublic?: boolean;
}): Metadata {
  const { username, movieTitle, year, slug, ratingLabel, review, posterUrl, isPublic = true } = params;
  const displayTitle = year ? `${movieTitle} (${year})` : movieTitle;
  const title = `${username} watched ${displayTitle}`;

  const parts = [
    `${username} logged ${displayTitle} on Canisterr`,
    ratingLabel && ratingLabel !== "Unrated" ? `— rated ${ratingLabel}` : null,
    review ? `— "${review.slice(0, 80).trimEnd()}${review.length > 80 ? "…" : ""}"` : null,
  ].filter(Boolean);
  const description = parts.join(" ").slice(0, 155);

  const canonicalPath = `/log/${username}/${slug}`;

  return baseMetadata({
    title,
    description,
    alternates: { canonical: canonical(canonicalPath) },
    robots: isPublic
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: {
      type: "article",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(canonicalPath),
      title,
      description,
      images: posterUrl ? [{ url: posterUrl, width: 500, height: 750, alt: displayTitle }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: posterUrl ? [posterUrl] : undefined,
    },
  });
}

export function reviewSchema(params: {
  reviewerName: string;
  reviewerUsername: string;
  reviewerAvatarUrl?: string | null;
  reviewBody: string;
  ratingValue: number;
  movieTitle: string;
  movieId: number;
  datePublished: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    author: {
      "@type": "Person",
      name: params.reviewerName,
      url: canonical(`/profile/${params.reviewerUsername}`),
      image: params.reviewerAvatarUrl ?? undefined,
    },
    reviewBody: params.reviewBody,
    reviewRating: {
      "@type": "Rating",
      ratingValue: params.ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: {
      "@type": "Movie",
      name: params.movieTitle,
      url: canonical(`/movie/${params.movieId}`),
    },
    datePublished: params.datePublished,
    publisher: { "@type": "Organization", name: "Canisterr", url: BASE_URL },
  };
}

export function personSchema(user: {
  name: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.name,
    url: canonical(`/profile/${user.username}`),
    image: user.avatar_url ?? undefined,
    description: user.bio ?? undefined,
  };
}

export function crewPersonSchema(person: {
  id: number;
  name: string;
  biography?: string | null;
  profileImageUrl?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  placeOfBirth?: string | null;
  knownDepartment?: string | null;
  externalLinks?: Array<{ url: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: canonical(`/crew/${person.id}-${slugify(person.name) || "person"}`),
    image: person.profileImageUrl ?? undefined,
    description: person.biography ?? undefined,
    birthDate: person.birthday ?? undefined,
    deathDate: person.deathday ?? undefined,
    birthPlace: person.placeOfBirth ?? undefined,
    jobTitle: person.knownDepartment ?? undefined,
    sameAs: (person.externalLinks || []).map((link) => link.url),
  };
}
