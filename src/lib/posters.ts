const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const DAY_IN_SECONDS = 86_400;

export type PosterItem = {
  title: string;
  source: "tmdb" | "tvmaze";
  posterUrl: string | null;
};

const tmdbTitles = [
  "La La Land",
  "Barbie",
  "Project Hail Mary",
  "12 Angry Men",
  "The Dark Knight",
  "Casino Royale",
  "Pather Panchali",
  "Charulata",
];

type TMDBSearchResult = {
  title?: string;
  original_title?: string;
  poster_path?: string | null;
};

function emptyPoster(title: string, source: PosterItem["source"]): PosterItem {
  return { title, source, posterUrl: null };
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestTmdbResult(results: TMDBSearchResult[], title: string) {
  const normalizedTarget = normalizeTitle(title);

  return results
    .filter((result) => result.poster_path)
    .sort((left, right) => {
      const score = (item: TMDBSearchResult) => {
        const candidate = normalizeTitle(item.title || item.original_title || "");
        if (candidate === normalizedTarget) return 3;
        if (candidate.startsWith(normalizedTarget)) return 2;
        if (candidate.includes(normalizedTarget)) return 1;
        return 0;
      };

      return score(right) - score(left);
    })[0];
}

export async function fetchTMDBPoster(title: string): Promise<PosterItem> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

    if (!apiKey) {
      return emptyPoster(title, "tmdb");
    }

    const res = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}`,
      { next: { revalidate: DAY_IN_SECONDS } }
    );

    if (!res.ok) {
      return emptyPoster(title, "tmdb");
    }

    const data = (await res.json()) as { results?: TMDBSearchResult[] };
    const movie = pickBestTmdbResult(Array.isArray(data.results) ? data.results : [], title);

    return {
      title,
      source: "tmdb",
      posterUrl: movie?.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    };
  } catch {
    return emptyPoster(title, "tmdb");
  }
}

export async function fetchTVMazePoster(title: string): Promise<PosterItem> {
  try {
    const res = await fetch(
      `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`,
      { next: { revalidate: DAY_IN_SECONDS } }
    );

    if (!res.ok) {
      return emptyPoster(title, "tvmaze");
    }

    const data = (await res.json()) as {
      image?: {
        original?: string;
        medium?: string;
      };
    };

    return {
      title,
      source: "tvmaze",
      posterUrl: data.image?.original || data.image?.medium || null,
    };
  } catch {
    return emptyPoster(title, "tvmaze");
  }
}

export async function getHomepagePosters(): Promise<PosterItem[]> {
  const tmdbPosters = await Promise.all(tmdbTitles.map(fetchTMDBPoster));
  const breakingBad = await fetchTVMazePoster("Breaking Bad");

  return [...tmdbPosters, breakingBad];
}
