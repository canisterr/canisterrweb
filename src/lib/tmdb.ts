import { TMDBMovie, TMDBPersonSearchResult, TMDBSearchResponse } from "@/types";
import { fetchTmdb } from "./tmdb-transport";
import type { TmdbWatchProviderAppend } from "./watch-providers";
import { getTmdbBackdropUrl, getTmdbImageUrl, getTmdbPosterUrl } from "./performance";
import { readBrowserCacheEntry, writeBrowserCache } from "./browser-cache";
import { searchMovieCatalog, upsertMovieCatalog } from "./movie-catalog";

// Genre ID mappings for TMDB discovery.
export const GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

interface TMDBDetailedMovie extends TmdbWatchProviderAppend {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  production_countries?: Array<{
    iso_3166_1?: string;
    name?: string;
  }>;
  production_companies?: Array<{
    id: number;
    name: string;
    origin_country?: string | null;
  }>;
  keywords?: {
    keywords?: Array<{ id: number; name: string }>;
  };
  origin_country?: string[];
  original_language?: string | null;
  director?: string;
  release_date: string;
  overview: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  videos?: {
    results: Array<{
      id: string;
      key: string;
      site: string;
      type: string;
      official?: boolean;
    }>;
  };
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
      order?: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job?: string;
      department?: string;
      profile_path?: string | null;
    }>;
  };
  images?: {
    backdrops?: Array<{ file_path: string; vote_average?: number }>;
  };
}

interface TMDBPersonSearchResponse {
  results: TMDBPersonSearchResult[];
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  biography: string | null;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  known_for_department?: string | null;
  popularity?: number | null;
  profile_path?: string | null;
  homepage?: string | null;
  also_known_as?: string[];
}

export interface TMDBPersonCredit {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  popularity?: number | null;
  original_language?: string | null;
  character?: string | null;
  job?: string | null;
  department?: string | null;
}

export interface TMDBPersonCombinedCreditsResponse {
  cast?: TMDBPersonCredit[];
  crew?: TMDBPersonCredit[];
}

export interface TMDBPersonExternalIds {
  imdb_id?: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
  tiktok_id?: string | null;
  youtube_id?: string | null;
  wikidata_id?: string | null;
}

interface TMDBPersonMovieCredit {
  id: number;
  title?: string;
  release_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

interface TMDBPersonMovieCreditsResponse {
  cast?: TMDBPersonMovieCredit[];
  crew?: Array<TMDBPersonMovieCredit & { job?: string }>;
}

type MovieDetailsResult = ReturnType<typeof normalizeMovieDetails> | null;

const movieDetailsCache = new Map<number, MovieDetailsResult>();
const movieDetailsInFlight = new Map<number, Promise<MovieDetailsResult>>();
const movieDetailsBlockedUntil = new Map<number, number>();
const MOVIE_DETAILS_BROWSER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const movieSearchRefreshInFlight = new Map<string, Promise<TMDBMovie[]>>();
const personSearchRefreshInFlight = new Map<string, Promise<TMDBPersonSearchResult[]>>();
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "film",
  "in",
  "movie",
  "of",
  "show",
  "the",
  "tv",
  "with",
]);

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchYear(query: string): number | null {
  const match = query.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function removeYear(query: string): string {
  return query.replace(/\b(19\d{2}|20\d{2})\b/g, " ").replace(/\s+/g, " ").trim();
}

function getSearchCacheKey(kind: string, query: string, page: number = 1): string {
  return `tmdb-search:${kind}:${page}:${normalizeSearchText(query)}`;
}

function getReleaseYear(movie: Pick<TMDBMovie, "release_date">): number | null {
  if (!movie.release_date) return null;
  const year = Number(movie.release_date.split("-")[0]);
  return Number.isFinite(year) ? year : null;
}

function uniqueMovies(movies: TMDBMovie[]): TMDBMovie[] {
  const seen = new Map<number, TMDBMovie>();
  movies.forEach((movie) => {
    if (!seen.has(movie.id)) {
      seen.set(movie.id, movie);
    }
  });
  return Array.from(seen.values());
}

async function fetchMovieSearch(query: string, page: number): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];
  const response = await fetchTmdb("search/movie", {
    query,
    page,
  });

  if (!response.ok) {
    throw new Error("Failed to search movies");
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

async function fetchMovieSearchForYear(query: string, year: number): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];
  const response = await fetchTmdb("search/movie", {
    query,
    page: 1,
    year,
    primary_release_year: year,
  });

  if (!response.ok) {
    throw new Error("Failed to search movies by year");
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

async function performMovieSearch(query: string, page: number = 1): Promise<TMDBMovie[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  if (page > 1) {
    const pagedResults = await fetchMovieSearch(trimmedQuery, page);
    await upsertMovieCatalog(pagedResults);
    return pagedResults;
  }

  const localResults = await searchMovieCatalog(trimmedQuery);
  if (localResults.length >= 10) {
    return rankMovieSearchResults(localResults, trimmedQuery, removeYear(trimmedQuery), {
      requestedYear: extractSearchYear(trimmedQuery),
      personMovieIds: new Set(),
    });
  }

  const requestedYear = extractSearchYear(trimmedQuery);
  const meaningfulTokenCount = normalizeSearchText(removeYear(trimmedQuery))
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token)).length;
  const people = meaningfulTokenCount >= 3 ? await findPeopleInQuery(trimmedQuery) : [];
  const titleQuery = removePersonChunksFromQuery(trimmedQuery, people) || removeYear(trimmedQuery);
  const searchPages = [1];
  const baseSearchQueries = Array.from(
    new Set([trimmedQuery, removeYear(trimmedQuery), titleQuery].filter((entry) => entry.trim().length >= 1))
  ).slice(0, 2);
  const yearSearchQueries = requestedYear
    ? Array.from(new Set([titleQuery, removeYear(trimmedQuery)].filter((entry) => entry.trim().length >= 1))).slice(0, 1)
    : [];

  const [movieResultGroups, personMovieIds] = await Promise.all([
    Promise.all([
      ...baseSearchQueries.flatMap((searchQuery) =>
        searchPages.map((searchPage) => fetchMovieSearch(searchQuery, searchPage).catch(() => []))
      ),
      ...yearSearchQueries.map((searchQuery) =>
        requestedYear ? fetchMovieSearchForYear(searchQuery, requestedYear).catch(() => []) : Promise.resolve([])
      ),
    ]),
    getPersonMovieIds(people),
  ]);

  const movies = uniqueMovies([...localResults, ...movieResultGroups.flat()]);

  if (movies.length === 0) {
    return [];
  }

  await upsertMovieCatalog(movies);

  return rankMovieSearchResults(movies, trimmedQuery, titleQuery, {
    requestedYear,
    personMovieIds,
  });
}

function getPossiblePersonChunks(query: string): string[] {
  const normalized = normalizeSearchText(removeYear(query));
  const tokens = normalized.split(" ").filter((token) => token && !STOP_WORDS.has(token));
  const chunks: string[] = [];

  for (let size = Math.min(4, tokens.length); size >= 2; size -= 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      chunks.push(tokens.slice(start, start + size).join(" "));
    }
  }

  return Array.from(new Set(chunks)).slice(0, 3);
}

async function findPeopleInQuery(query: string): Promise<Array<{ id: number; name: string; chunk: string }>> {
  const chunks = getPossiblePersonChunks(query);
  const people: Array<{ id: number; name: string; chunk: string }> = [];
  const seen = new Set<number>();

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await fetchTmdb("search/person", {
          query: chunk,
          page: 1,
        });
        if (!response.ok) return;

        const data: TMDBPersonSearchResponse = await response.json();
        const chunkNorm = normalizeSearchText(chunk);
        const match = data.results
          .filter((person) => person.known_for_department !== "Sound")
          .find((person) => {
            const nameNorm = normalizeSearchText(person.name);
            return nameNorm === chunkNorm || nameNorm.includes(chunkNorm) || chunkNorm.includes(nameNorm);
          });

        if (match && !seen.has(match.id)) {
          seen.add(match.id);
          people.push({ id: match.id, name: match.name, chunk });
        }
      } catch (error) {
        console.error("TMDB person search error:", error);
      }
    })
  );

  return people.slice(0, 3);
}

function removePersonChunksFromQuery(query: string, people: Array<{ chunk: string }>): string {
  let cleaned = normalizeSearchText(removeYear(query));
  people.forEach((person) => {
    const chunk = normalizeSearchText(person.chunk);
    cleaned = ` ${cleaned} `.replace(` ${chunk} `, " ");
  });

  return cleaned
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ");
}

async function getPersonMovieIds(people: Array<{ id: number }>): Promise<Set<number>> {
  const ids = new Set<number>();

  await Promise.all(
    people.map(async (person) => {
      try {
        const response = await fetchTmdb(`person/${person.id}/movie_credits`);
        if (!response.ok) return;

        const data: TMDBPersonMovieCreditsResponse = await response.json();
        [...(data.cast || []), ...(data.crew || [])].forEach((credit) => {
          if (credit.id) ids.add(credit.id);
        });
      } catch (error) {
        console.error("TMDB person credits error:", error);
      }
    })
  );

  return ids;
}

function rankMovieSearchResults(
  movies: TMDBMovie[],
  query: string,
  titleQuery: string,
  options: {
    requestedYear: number | null;
    personMovieIds: Set<number>;
  }
): TMDBMovie[] {
  const normalizedTitleQuery = normalizeSearchText(titleQuery || removeYear(query));
  const queryTokens = normalizedTitleQuery.split(" ").filter(Boolean);

  return movies.slice().sort((a, b) => {
    const score = (movie: TMDBMovie) => {
      const movieTitle = normalizeSearchText(movie.title);
      const movieYear = getReleaseYear(movie);
      let value = 0;

      if (movieTitle === normalizedTitleQuery) value += 120;
      if (normalizedTitleQuery && movieTitle.includes(normalizedTitleQuery)) value += 70;
      value += queryTokens.filter((token) => movieTitle.includes(token)).length * 18;

      if (options.requestedYear && movieYear === options.requestedYear) value += 240;
      if (options.requestedYear && movieYear && Math.abs(movieYear - options.requestedYear) === 1) value += 25;
      if (options.personMovieIds.has(movie.id)) value += 140;

      value += Math.min(movie.popularity || 0, 80) * 0.35;
      value += Math.min(movie.vote_count || 0, 1000) * 0.01;
      value += (movie.vote_average || 0) * 1.5;

      return value;
    };

    return score(b) - score(a);
  });
}

function normalizeMovieDetails(data: TMDBDetailedMovie) {
  let director: string | null = null;
  let actors: string[] | null = null;
  const castDetails = (data.credits?.cast || [])
    .slice(0, 20)
    .map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character || null,
      profile_url: getTmdbImageUrl(person.profile_path || null, "w185"),
    }));

  const crewDetails = (data.credits?.crew || [])
    .filter((person) =>
      ["Director", "Producer", "Executive Producer", "Cinematography", "Director of Photography", "Editor", "Original Music Composer", "Music"].includes(
        person.job || ""
      )
    )
    .map((person) => ({
      id: person.id,
      name: person.name,
      job: person.job || null,
      department: person.department || null,
      profile_url: getTmdbImageUrl(person.profile_path || null, "w185"),
    }));

  if (data.credits?.crew) {
    const directorObj = data.credits.crew.find((person) => person.job === "Director");
    director = directorObj?.name || null;
  }

  if (data.credits?.cast) {
    actors = data.credits.cast
      .slice(0, 5)
      .map((person) => person.name);
  }

  const trailer =
    data.videos?.results?.find(
      (video) => video.site === "YouTube" && video.type === "Trailer" && video.official
    ) || data.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer");

  const backdropGalleryUrls = (data.images?.backdrops || [])
    .slice(0, 6)
    .map((backdrop) => getTmdbImageUrl(backdrop.file_path, "w780"))
    .filter((url): url is string => Boolean(url));

  return {
    id: data.id,
    title: data.title,
    poster_url: getTmdbPosterUrl(data.poster_path, "w500"),
    backdrop_url: getTmdbBackdropUrl(data.backdrop_path, "w780"),
    backdrop_gallery_urls: backdropGalleryUrls,
    genres: data.genres.map((g) => g.name),
    director,
    actors,
    language: (data as any).original_language || null,
    country: data.production_countries?.[0]?.name || null,
    countries:
      data.production_countries
        ?.map((country) => country.name || "")
        .filter((country) => country.trim().length > 0) || null,
    production_countries: data.production_countries?.map((country) => ({
      name: country.name || "",
      iso_3166_1: country.iso_3166_1 || null,
    })) || null,
    production_companies: data.production_companies?.map((company) => ({
      name: company.name,
      origin_country: company.origin_country || null,
    })) || null,
    origin_countries: data.origin_country || null,
    keywords:
      data.keywords?.keywords?.map((keyword) => keyword.name).filter(Boolean) || null,
    studios:
      data.production_companies?.map((company) => company.name).filter(Boolean) || null,
    release_date: data.release_date,
    overview: data.overview,
    runtime: data.runtime,
    rating: data.vote_average,
    popularity: data.popularity,
    vote_count: data.vote_count,
    platforms: [],
    watch_providers: data["watch/providers"]?.results || null,
    cast_details: castDetails,
    crew_details: crewDetails,
    trailer_key: trailer?.key || null,
  };
}

export async function searchMovies(query: string, page: number = 1) {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const cacheKey = getSearchCacheKey("movie", trimmedQuery, page);
    const cachedEntry = readBrowserCacheEntry<TMDBMovie[]>(cacheKey);
    if (cachedEntry) {
      const cached = cachedEntry.value ?? [];
      if (!cachedEntry.isStale) return cached;
      if (!movieSearchRefreshInFlight.has(cacheKey)) {
        const refreshPromise = performMovieSearch(trimmedQuery, page)
          .then((fresh) => {
            writeBrowserCache(cacheKey, fresh, SEARCH_CACHE_TTL_MS);
            return fresh;
          })
          .catch((error) => {
            console.error("TMDB search refresh error:", error);
            return cached;
          })
          .finally(() => {
            movieSearchRefreshInFlight.delete(cacheKey);
          });

        movieSearchRefreshInFlight.set(cacheKey, refreshPromise);
      }

      return cached;
    }

    const fresh = await performMovieSearch(trimmedQuery, page);
    writeBrowserCache(cacheKey, fresh, SEARCH_CACHE_TTL_MS);
    return fresh;
  } catch (error) {
    console.error("TMDB search error:", error);
    return [];
  }
}

/** One-request movie lookup for bulk CSV imports; skips per-query catalog/person searches. */
export async function searchMoviesForImport(query: string, year?: number) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const cacheQuery = year ? `${trimmedQuery} ${year}` : trimmedQuery;
  const cacheKey = getSearchCacheKey("movie-import", cacheQuery, 1);
  const cached = readBrowserCacheEntry<TMDBMovie[]>(cacheKey);
  if (cached && !cached.isStale) return cached.value || [];

  const response = await fetchTmdb("search/movie", {
    query: trimmedQuery,
    page: 1,
    ...(year ? { year } : {}),
  });
  if (!response.ok) throw new Error("Could not search movie titles for this import.");

  const data = await response.json() as TMDBSearchResponse;
  const results = Array.isArray(data.results) ? data.results : [];
  writeBrowserCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
  return results;
}

export async function discoverMoviesByProductionCountry(countryCode: string): Promise<TMDBMovie[]> {
  if (!/^[A-Z]{2}$/.test(countryCode)) return [];
  try {
    const response = await fetchTmdb("discover/movie", {
      with_origin_country: countryCode,
      sort_by: "popularity.desc",
      "vote_count.gte": 50,
      include_adult: false,
      page: 1,
    });
    if (!response.ok) return [];
    const data: TMDBSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("TMDB country discovery error:", error);
    return [];
  }
}

export async function discoverPassportMovies(
  countryCode: string,
  options: { genreId?: number; fromYear?: number; toYear?: number; page?: number; sort?: "popular" | "topRated" } = {}
): Promise<{ movies: TMDBMovie[]; totalPages: number; totalResults: number }> {
  if (!/^[A-Z]{2}$/.test(countryCode)) return { movies: [], totalPages: 0, totalResults: 0 };
  const page = Math.max(1, Math.min(500, Math.trunc(options.page || 1)));
  const cutoff = options.toYear ? `${options.toYear}-12-31` : new Date().toISOString().slice(0, 10);
  const cacheKey = `passport:discover:v1:${countryCode}:${options.sort || "popular"}:${options.genreId || 0}:${options.fromYear || 0}:${cutoff}:${page}`;
  const cached = readBrowserCacheEntry<{ movies: TMDBMovie[]; totalPages: number; totalResults: number }>(cacheKey);
  if (cached?.value && !cached.isStale) return cached.value;
  const response = await fetchTmdb("discover/movie", {
    with_origin_country: countryCode,
    with_genres: options.genreId,
    "primary_release_date.gte": options.fromYear ? `${options.fromYear}-01-01` : undefined,
    "primary_release_date.lte": cutoff,
    sort_by: options.sort === "topRated" ? "vote_average.desc" : "popularity.desc",
    "vote_count.gte": options.sort === "topRated" ? 100 : undefined,
    include_adult: false,
    page,
  });
  if (!response.ok) throw new Error("Country discovery is unavailable");
  const data: TMDBSearchResponse = await response.json();
  const result = {
    movies: data.results || [],
    totalPages: Math.min(500, data.total_pages || 0),
    totalResults: data.total_results || 0,
  };
  writeBrowserCache(cacheKey, result, 30 * 60 * 1000);
  return result;
}

export async function searchPeople(query: string): Promise<TMDBPersonSearchResult[]> {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const cacheKey = getSearchCacheKey("person", trimmedQuery, 1);
    const cachedEntry = readBrowserCacheEntry<TMDBPersonSearchResult[]>(cacheKey);
    if (cachedEntry) {
      const cached = cachedEntry.value ?? [];
      if (!cachedEntry.isStale) return cached;
      if (!personSearchRefreshInFlight.has(cacheKey)) {
        const refreshPromise = (async () => {
          const response = await fetchTmdb("search/person", {
            query: trimmedQuery,
            page: 1,
          });

          if (!response.ok) {
            throw new Error("Failed to search people");
          }

          const data: TMDBPersonSearchResponse = await response.json();
          return data.results
            .slice()
            .sort((a, b) => {
              const aHasImage = a.profile_path ? 1 : 0;
              const bHasImage = b.profile_path ? 1 : 0;
              if (aHasImage !== bHasImage) return bHasImage - aHasImage;
              return (b.popularity || 0) - (a.popularity || 0);
            });
        })()
          .then((fresh) => {
            writeBrowserCache(cacheKey, fresh, SEARCH_CACHE_TTL_MS);
            return fresh;
          })
          .catch((error) => {
            console.error("TMDB people search refresh error:", error);
            return cached;
          })
          .finally(() => {
            personSearchRefreshInFlight.delete(cacheKey);
          });

        personSearchRefreshInFlight.set(cacheKey, refreshPromise);
      }

      return cached;
    }

    const response = await fetchTmdb("search/person", {
      query: trimmedQuery,
      page: 1,
    });

    if (!response.ok) {
      throw new Error("Failed to search people");
    }

    const data: TMDBPersonSearchResponse = await response.json();
    const results = data.results
      .slice()
      .sort((a, b) => {
        const aHasImage = a.profile_path ? 1 : 0;
        const bHasImage = b.profile_path ? 1 : 0;
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;
        return (b.popularity || 0) - (a.popularity || 0);
      });
    writeBrowserCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error("TMDB people search error:", error);
    return [];
  }
}

export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails | null> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      return null;
    }

    const response = await fetchTmdb(`person/${personId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch person details");
    }

    return (await response.json()) as TMDBPersonDetails;
  } catch (error) {
    console.error("TMDB person details error:", error);
    return null;
  }
}

export async function getPersonCombinedCredits(
  personId: number
): Promise<TMDBPersonCombinedCreditsResponse | null> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      return null;
    }

    const response = await fetchTmdb(`person/${personId}/combined_credits`);
    if (!response.ok) {
      throw new Error("Failed to fetch person credits");
    }

    return (await response.json()) as TMDBPersonCombinedCreditsResponse;
  } catch (error) {
    console.error("TMDB person credits error:", error);
    return null;
  }
}

export async function getPersonExternalIds(personId: number): Promise<TMDBPersonExternalIds | null> {
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      return null;
    }

    const response = await fetchTmdb(`person/${personId}/external_ids`);
    if (!response.ok) {
      throw new Error("Failed to fetch person external ids");
    }

    return (await response.json()) as TMDBPersonExternalIds;
  } catch (error) {
    console.error("TMDB person external ids error:", error);
    return null;
  }
}

export async function getMovieDetails(movieId: number) {
  const cached = movieDetailsCache.get(movieId);
  if (cached !== undefined) {
    return cached;
  }

  const browserCacheKey = `tmdb:movie-details:v2:${movieId}`;
  const missingCacheKey = `tmdb:movie-missing:v1:${movieId}`;
  const browserEntry = readBrowserCacheEntry<NonNullable<MovieDetailsResult>>(browserCacheKey);
  if (browserEntry?.value && !browserEntry.isStale) {
    movieDetailsCache.set(movieId, browserEntry.value);
    return browserEntry.value;
  }
  if (readBrowserCacheEntry<boolean>(missingCacheKey)?.isStale === false) {
    return browserEntry?.value ?? null;
  }

  const blockedUntil = movieDetailsBlockedUntil.get(movieId) || 0;
  if (blockedUntil > Date.now()) {
    return browserEntry?.value ?? null;
  }

  const inFlight = movieDetailsInFlight.get(movieId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
  try {
    const response = await fetchTmdb(`movie/${movieId}`, {
      append_to_response: "credits,videos,keywords,images,watch/providers",
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        writeBrowserCache(missingCacheKey, true, 24 * 60 * 60 * 1000);
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000;
        movieDetailsBlockedUntil.set(movieId, Date.now() + waitMs);
      }
      console.warn(`TMDB movie details unavailable for ${movieId}: ${response.status}`);
      return browserEntry?.value ?? null;
    }

    const data: TMDBDetailedMovie = await response.json();
    const normalized = normalizeMovieDetails(data);
    movieDetailsCache.set(movieId, normalized);
    writeBrowserCache(browserCacheKey, normalized, MOVIE_DETAILS_BROWSER_TTL_MS);
    return normalized;
  } catch (error) {
    console.error("TMDB detail error:", error);
    return browserEntry?.value ?? null;
  } finally {
    movieDetailsInFlight.delete(movieId);
  }
  })();

  movieDetailsInFlight.set(movieId, request);
  return request;
}

/** Fetch just the fields needed for compact list poster previews. */
export async function getMovieCardSummary(movieId: number): Promise<{ title: string; poster_url: string | null } | null> {
  const details = readBrowserCacheEntry<NonNullable<MovieDetailsResult>>(`tmdb:movie-details:v2:${movieId}`);
  if (details?.value && !details.isStale) return { title: details.value.title, poster_url: details.value.poster_url || null };
  const cacheKey = `tmdb:movie-card-summary:v1:${movieId}`;
  const cached = readBrowserCacheEntry<{ title: string; poster_url: string | null }>(cacheKey);
  if (cached?.value && !cached.isStale) return cached.value;
  try {
    const response = await fetchTmdb(`movie/${movieId}`);
    if (!response.ok) return cached?.value ?? null;
    const data = await response.json() as { title?: string; poster_path?: string | null };
    if (!data.title) return null;
    const summary = { title: data.title, poster_url: getTmdbPosterUrl(data.poster_path || null, "w500") };
    writeBrowserCache(cacheKey, summary, 30 * 24 * 60 * 60 * 1000);
    return summary;
  } catch {
    return cached?.value ?? null;
  }
}

export async function getSimilarMovies(movieId: number, limit: number = 10) {
  try {
    const response = await fetchTmdb(`movie/${movieId}/similar`);

    if (!response.ok) {
      throw new Error("Failed to fetch similar movies");
    }

    const data: TMDBSearchResponse = await response.json();

  return data.results.slice(0, limit).map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_url: getTmdbPosterUrl(movie.poster_path, "w500"),
      backdrop_url: null,
      genres: null,
      director: null,
      actors: null,
      language: null,
      release_date: movie.release_date || null,
      overview: movie.overview || null,
      runtime: movie.runtime || null,
      rating: movie.vote_average || null,
      platforms: [],
      created_at: new Date().toISOString(),
      type: "movie" as const,
    }));
  } catch (error) {
    console.error("TMDB similar movies error:", error);
    return [];
  }
}

export interface TasteRecommendation {
  id: number;
  tmdb_id?: number;
  title: string;
  poster_url: string | null;
  release_date: string | null;
  overview: string | null;
  genres: string[];
  type: "movie" | "tv";
}

const tasteRecommendationRequests = new Map<string, Promise<TasteRecommendation[]>>();

/** One cached TMDB request per media type and taste seed, or popular titles for a new profile. */
export async function getTasteRecommendations(
  type: "movie" | "tv",
  seedId?: number | null
): Promise<TasteRecommendation[]> {
  const safeSeedId = Number.isFinite(seedId) && Number(seedId) > 0 ? Number(seedId) : null;
  const cacheKey = `taste-recommendations:v2:${type}:${safeSeedId ?? "top-rated"}`;
  const cached = readBrowserCacheEntry<TasteRecommendation[]>(cacheKey);
  if (cached?.value && !cached.isStale) return cached.value;
  const inFlight = tasteRecommendationRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const path = safeSeedId
      ? `${type}/${safeSeedId}/recommendations`
      : `${type}/top_rated`;
    const response = await fetchTmdb(path, { page: 1 });
    if (!response.ok) throw new Error("Recommendations are unavailable");
    const data: TMDBSearchResponse = await response.json();
    const recommendations = (data.results || []).map((item: any) => ({
      id: type === "tv" ? 1_000_000_000 + item.id : item.id,
      ...(type === "tv" ? { tmdb_id: item.id } : {}),
      title: item.title || item.name || "Untitled",
      poster_url: getTmdbPosterUrl(item.poster_path, "w300"),
      release_date: item.release_date || item.first_air_date || null,
      overview: item.overview || null,
      genres: Object.entries(GENRE_MAP).filter(([, genreId]) => item.genre_ids?.includes(genreId)).map(([genre]) => genre),
      type,
    }));
    writeBrowserCache(cacheKey, recommendations, 12 * 60 * 60 * 1000);
    return recommendations;
  })().finally(() => tasteRecommendationRequests.delete(cacheKey));

  tasteRecommendationRequests.set(cacheKey, request);
  return request;
}

export function getTMDBImageUrl(
  path: string | null,
  size: "w300" | "w500" | "w780" | "original" = "w500"
) {
  return getTmdbImageUrl(path, size);
}
