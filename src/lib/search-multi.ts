import type { TMDBMovie, TMDBPersonSearchResult } from "@/types";
import type { ShowDetails } from "./tvmaze";
import { TMDB_TV_ID_OFFSET, searchTVMazeShowsOnly } from "./tvmaze";
import { searchMovieCatalog, upsertMovieCatalog } from "./movie-catalog";
import { fetchTmdb } from "./tmdb-transport";
import { getTmdbPosterUrl } from "./performance";
import { readBrowserCacheEntry, writeBrowserCache } from "./browser-cache";

type MultiSearchResult = {
  movies: TMDBMovie[];
  shows: ShowDetails[];
  people: TMDBPersonSearchResult[];
};

type MultiSearchItem = {
  media_type: "movie" | "tv" | "person";
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
  original_language?: string;
  known_for_department?: string;
  known_for?: TMDBPersonSearchResult["known_for"];
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<MultiSearchResult>>();
let blockedUntil = 0;

async function localSearchFallback(query: string): Promise<MultiSearchResult> {
  const [movies, shows] = await Promise.all([
    searchMovieCatalog(query).catch(() => []),
    searchTVMazeShowsOnly(query),
  ]);
  return { movies, shows, people: [] };
}

async function fetchMultiSearch(query: string): Promise<MultiSearchResult> {
  const response = await fetchTmdb("search/multi", { query, page: 1, include_adult: false });
  if (!response.ok) throw new Error(`Combined search failed: ${response.status}`);

  const data = (await response.json()) as { results?: MultiSearchItem[] };
  const results: MultiSearchResult = { movies: [], shows: [], people: [] };

  for (const item of data.results || []) {
    if (!Number.isFinite(item.id)) continue;

    if (item.media_type === "movie" && item.title) {
      results.movies.push({
        id: item.id,
        title: item.title,
        poster_path: item.poster_path || null,
        genres: item.genre_ids || [],
        genre_ids: item.genre_ids || [],
        director: null,
        original_language: item.original_language || null,
        release_date: item.release_date || "",
        overview: item.overview || "",
        runtime: 0,
        vote_average: item.vote_average || 0,
        popularity: item.popularity || 0,
      });
    } else if (item.media_type === "tv" && item.name) {
      const poster = getTmdbPosterUrl(item.poster_path || item.backdrop_path, "w500");
      results.shows.push({
        id: TMDB_TV_ID_OFFSET + item.id,
        name: item.name,
        title: item.name,
        type: "tv",
        source: "tmdb",
        tmdb_id: item.id,
        poster_url: poster || undefined,
        poster_path: poster || undefined,
        genres: [],
        overview: item.overview || "",
        release_date: item.first_air_date || "",
        premiered: item.first_air_date || "",
        rating: { average: item.vote_average || 0 },
        language: item.original_language || "en",
      });
    } else if (item.media_type === "person" && item.name) {
      results.people.push({
        id: item.id,
        name: item.name,
        profile_path: item.profile_path || null,
        known_for_department: item.known_for_department || null,
        popularity: item.popularity || 0,
        known_for: item.known_for,
      });
    }
  }

  return results;
}

export async function searchMulti(query: string): Promise<MultiSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { movies: [], shows: [], people: [] };

  const key = `tmdb-search:multi:v1:${trimmed.toLowerCase().replace(/\s+/g, " ")}`;
  const cached = readBrowserCacheEntry<MultiSearchResult>(key);
  if (cached && !cached.isStale) return cached.value || { movies: [], shows: [], people: [] };
  if (blockedUntil > Date.now()) return cached?.value || localSearchFallback(trimmed);

  let request = inFlight.get(key);
  if (!request) {
    request = fetchMultiSearch(trimmed)
      .then((results) => {
        writeBrowserCache(key, results, CACHE_TTL_MS);
        if (results.movies.length > 0) void upsertMovieCatalog(results.movies);
        return results;
      })
      .catch(async () => {
        blockedUntil = Date.now() + 60_000;
        return cached?.value || localSearchFallback(trimmed);
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }

  if (cached?.value) {
    void request.catch(() => {});
    return cached.value;
  }
  return request;
}
