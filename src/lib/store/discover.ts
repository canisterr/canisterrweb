import { fetchTmdb } from "@/lib/tmdb-transport";
import { getTmdbPosterUrl, getTmdbBackdropUrl } from "@/lib/performance";
import { getMovieDetails } from "@/lib/tmdb";
import type { TMDBMovie, TMDBSearchResponse } from "@/types";
import type { CatalogShelfQuery, DiscoverShelfQuery, ShelfQuery, StoreMovieSummary } from "@/types/store";

const DISCOVER_CACHE_TTL_MS = 10 * 60 * 1000;
const STATIC_CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  movies: StoreMovieSummary[];
}

const shelfCache = new Map<string, CacheEntry>();
const shelfInFlight = new Map<string, Promise<StoreMovieSummary[]>>();

function toStoreMovieSummary(movie: TMDBMovie): StoreMovieSummary {
  const year = movie.release_date ? Number.parseInt(movie.release_date.slice(0, 4), 10) : null;
  return {
    id: movie.id,
    title: movie.title,
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    releaseYear: Number.isFinite(year) ? year : null,
    rating: typeof movie.vote_average === "number" ? movie.vote_average : null,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whitelists + coerces a shelf's declarative query into safe TMDB /discover/movie
 * params. Nothing outside this known key set is ever forwarded upstream.
 */
function buildDiscoverParams(query: DiscoverShelfQuery, page: number): Record<string, string | number | boolean> {
  const resolvedPage = Number.isInteger(page) && page >= 1 && page <= 20 ? page : 1;
  const params: Record<string, string | number | boolean> = {
    sort_by: query.sort_by || "popularity.desc",
    include_adult: false,
    page: resolvedPage,
  };

  const genreIds = query.with_genres?.filter((id) => Number.isInteger(id) && id > 0);
  if (genreIds?.length) params.with_genres = genreIds.join(query.genreLogic === "or" ? "|" : ",");

  const excludeGenreIds = query.without_genres?.filter((id) => Number.isInteger(id) && id > 0);
  if (excludeGenreIds?.length) params.without_genres = excludeGenreIds.join(",");

  if (typeof query.voteCountGte === "number") {
    params["vote_count.gte"] = Math.max(0, Math.floor(query.voteCountGte));
  }
  if (typeof query.voteAverageGte === "number") {
    params["vote_average.gte"] = clamp(query.voteAverageGte, 0, 10);
  }
  if (query.releaseDateGte && DATE_PATTERN.test(query.releaseDateGte)) {
    params["primary_release_date.gte"] = query.releaseDateGte;
  }
  if (query.releaseDateLte && DATE_PATTERN.test(query.releaseDateLte)) {
    params["primary_release_date.lte"] = query.releaseDateLte;
  }
  if (query.withOriginalLanguage && LANGUAGE_CODE_PATTERN.test(query.withOriginalLanguage)) {
    params.with_original_language = query.withOriginalLanguage.toLowerCase();
  }
  if (typeof query.runtimeGte === "number") {
    params["with_runtime.gte"] = Math.max(0, Math.floor(query.runtimeGte));
  }
  if (typeof query.runtimeLte === "number") {
    params["with_runtime.lte"] = Math.max(0, Math.floor(query.runtimeLte));
  }

  return params;
}

async function fetchDiscoverShelf(query: DiscoverShelfQuery, limit: number, page: number): Promise<StoreMovieSummary[]> {
  const params = buildDiscoverParams(query, page);
  const response = await fetchTmdb("discover/movie", params);
  if (!response.ok) {
    throw new Error(`discover/movie failed with status ${response.status}`);
  }
  const data: TMDBSearchResponse = await response.json();
  return data.results.slice(0, limit).map(toStoreMovieSummary);
}

const CATALOG_PATHS: Record<CatalogShelfQuery["source"], string> = {
  trending_day: "trending/movie/day",
  trending_week: "trending/movie/week",
  popular: "movie/popular",
};

async function fetchCatalogShelf(query: CatalogShelfQuery, limit: number, page: number): Promise<StoreMovieSummary[]> {
  const resolvedPage = Number.isInteger(page) && page >= 1 && page <= 20 ? page : 1;
  const response = await fetchTmdb(CATALOG_PATHS[query.source], { page: resolvedPage });
  if (!response.ok) {
    throw new Error(`${CATALOG_PATHS[query.source]} failed with status ${response.status}`);
  }
  const data: TMDBSearchResponse = await response.json();
  return data.results.slice(0, limit).map(toStoreMovieSummary);
}

async function fetchStaticShelf(ids: number[], limit: number): Promise<StoreMovieSummary[]> {
  const uniqueIds = Array.from(new Set(ids)).slice(0, limit);
  const details = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        return await getMovieDetails(id);
      } catch {
        return null;
      }
    })
  );

  return details
    .filter((movie): movie is NonNullable<typeof movie> => movie !== null)
    .map(
      (movie): StoreMovieSummary => ({
        id: movie.id,
        title: movie.title,
        posterPath: null,
        backdropPath: null,
        releaseYear: movie.release_date ? Number.parseInt(movie.release_date.slice(0, 4), 10) || null : null,
        rating: movie.rating ?? null,
        // getMovieDetails already returns full CDN URLs, not raw paths.
        posterUrl: movie.poster_url,
        backdropUrl: movie.backdrop_url,
      })
    );
}

/** Resolves a poster/backdrop URL for a shelf item, whichever source it came from. */
export function getShelfPosterUrl(movie: StoreMovieSummary, size: Parameters<typeof getTmdbPosterUrl>[1] = "w342") {
  if (movie.posterUrl) return movie.posterUrl;
  return getTmdbPosterUrl(movie.posterPath, size);
}

export function getShelfBackdropUrl(movie: StoreMovieSummary, size: Parameters<typeof getTmdbBackdropUrl>[1] = "w780") {
  if (movie.backdropUrl) return movie.backdropUrl;
  return getTmdbBackdropUrl(movie.backdropPath ?? null, size);
}

const MAX_REFRESH_PAGE = 5;

/** Deterministically maps a "refresh" click count to a different (but still good-quality) TMDB page. */
export function pageForRefreshSeed(seed: number): number {
  return (seed % MAX_REFRESH_PAGE) + 1;
}

/**
 * Fetches (and caches) the movies for a single shelf. Safe to call repeatedly —
 * in-memory TTL cache + in-flight de-dupe mean re-entering an aisle never
 * re-hits TMDB. Pass a different `page` (see pageForRefreshSeed) to surface a
 * different set of titles instead of the same page-1 results every time.
 */
export async function fetchShelfMovies(
  shelfId: string,
  query: ShelfQuery,
  limit = 24,
  page = 1
): Promise<StoreMovieSummary[]> {
  const cacheKey = `${shelfId}:${JSON.stringify(query)}:${limit}:${page}`;
  const cached = shelfCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.movies;
  }

  const inFlight = shelfInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const movies =
        query.kind === "static"
          ? await fetchStaticShelf(query.ids, limit)
          : query.kind === "catalog"
            ? await fetchCatalogShelf(query, limit, page)
            : await fetchDiscoverShelf(query, limit, page);
      shelfCache.set(cacheKey, {
        expiresAt: Date.now() + (query.kind === "static" ? STATIC_CACHE_TTL_MS : DISCOVER_CACHE_TTL_MS),
        movies,
      });
      return movies;
    } catch (error) {
      // Expected/handled: TMDB upstream hiccups fall back to cached (or empty) results.
      // console.warn (not .error) so Next's dev overlay doesn't treat this as a crash.
      console.warn(`Store shelf "${shelfId}" fetch error, falling back:`, error);
      return cached?.movies ?? [];
    } finally {
      shelfInFlight.delete(cacheKey);
    }
  })();

  shelfInFlight.set(cacheKey, request);
  return request;
}
