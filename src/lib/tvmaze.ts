import { fetchTmdb } from "./tmdb-transport";
import { readBrowserCacheEntry, writeBrowserCache } from "./browser-cache";

const TVMAZE_BASE_URL = "https://api.tvmaze.com";
export const LIKELY_TMDB_TV_ID_THRESHOLD = 100000;
export const TMDB_TV_ID_OFFSET = 1000000000;
const SHOW_SEARCH_CACHE_VERSION = "v2";
const showSearchRefreshInFlight = new Map<string, Promise<ShowDetails[]>>();
const showBrowseRefreshInFlight = new Map<string, Promise<ShowDetails[]>>();
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const BROWSE_CACHE_TTL_MS = 60 * 60 * 1000;

export interface TVMazeShow {
  id: number;
  name: string;
  image?: {
    medium?: string;
    original?: string;
  };
  summary?: string;
  premiered?: string;
  runtime?: number;
  rating?: {
    average?: number;
  };
  genres?: string[];
  status?: string;
  network?: {
    name?: string;
  };
}

export interface TVMazeCreditPerson {
  id: number;
  name: string;
  image?: {
    medium?: string;
    original?: string;
  };
}

export interface TVMazeCastCredit {
  person: TVMazeCreditPerson;
  character?: {
    name?: string;
  };
}

export interface TVMazeCrewCredit {
  person: TVMazeCreditPerson;
  type?: string;
}

export interface ShowDetails extends TVMazeShow {
  type: "tv";
  title?: string;
  poster_url?: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  language?: string;
  source?: "tvmaze" | "tmdb";
  tmdb_id?: number;
  tvmaze_id?: number;
  cast_details?: Array<{
    id: number;
    name: string;
    profile_url: string | null;
    character?: string | null;
    job?: string | null;
    department?: string | null;
  }>;
  crew_details?: Array<{
    id: number;
    name: string;
    profile_url: string | null;
    character?: string | null;
    job?: string | null;
    department?: string | null;
  }>;
}

type TVMazeMappedCreditPerson = NonNullable<ShowDetails["cast_details"]>[number];

interface TMDBTVSearchResult {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
  episode_run_time?: number[];
  status?: string;
  networks?: Array<{ name?: string }>;
  original_language?: string;
}

interface TMDBTVSearchResponse {
  results: TMDBTVSearchResult[];
}

interface TMDBTVDetails {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  overview: string;
  first_air_date: string;
  episode_run_time?: number[];
  vote_average?: number;
  status?: string;
  networks?: Array<{ name?: string }>;
  origin_country?: string[];
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

type ShowLike = Pick<ShowDetails, "id" | "name" | "title" | "premiered" | "release_date" | "source" | "tmdb_id" | "tvmaze_id">;

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeShowSummary(value: string | null | undefined): string {
  return value?.replace(/<[^>]*>/g, "") || "";
}

function getShowYear(show: Pick<ShowDetails, "premiered" | "release_date"> | null | undefined): string {
  const raw = show?.premiered || show?.release_date || "";
  const year = raw.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

function getShowTitle(show: Pick<ShowDetails, "name" | "title"> | null | undefined): string {
  return show?.title || show?.name || "";
}

function getShowIdentityKey(show: ShowLike): string {
  return `${normalizeSearchText(getShowTitle(show))}|${getShowYear(show)}`;
}

export function getTmdbLookupId(showId: number, explicitTmdbId?: number | null): number | null {
  if (typeof explicitTmdbId === "number" && Number.isFinite(explicitTmdbId) && explicitTmdbId > 0) {
    return explicitTmdbId;
  }
  if (showId >= TMDB_TV_ID_OFFSET) {
    return showId - TMDB_TV_ID_OFFSET;
  }
  if (showId >= LIKELY_TMDB_TV_ID_THRESHOLD) {
    return showId;
  }
  return null;
}

function normalizeShowSearchQuery(query: string): string {
  const normalized = normalizeSearchText(query);
  const yearMatch = normalized.match(/\b(19|20)\d{2}$/);
  const yearSuffix = yearMatch?.[0] || "";
  const normalizedTitle = yearSuffix
    ? normalized.slice(0, normalized.lastIndexOf(yearSuffix)).trim()
    : normalized;
  const compact = normalizedTitle.replace(/\s+/g, "");
  const brooklynSuffix = compact.match(/(99|nine9|ninenine)$/)?.[0] || "";
  const brooklynTitle = brooklynSuffix ? compact.slice(0, -brooklynSuffix.length) : "";

  if (
    compact === "b99" ||
    /^bro?oklyn(99|nine9|ninenine)$/.test(compact) ||
    /^bro?oklyn\s+(99|nine\s*9|nine\s*nine)$/.test(normalizedTitle) ||
    (Boolean(brooklynSuffix) && brooklynTitle.startsWith("br") && getEditDistance(brooklynTitle, "brooklyn") <= 4)
  ) {
    return yearSuffix ? `Brooklyn Nine-Nine ${yearSuffix}` : "Brooklyn Nine-Nine";
  }

  return query.trim();
}

function getEditDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1]
        ? previous[j - 1]
        : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1;
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function getShowSearchCacheKey(query: string): string {
  return `tv-search:${SHOW_SEARCH_CACHE_VERSION}:${normalizeSearchText(query)}`;
}

function getShowBrowseCacheKey(genres: string[]): string {
  return `tv-browse:${genres.map((genre) => normalizeSearchText(genre)).sort().join("|")}`;
}

function dedupeShows(shows: ShowDetails[]): ShowDetails[] {
  const seen = new Map<number, ShowDetails>();
  shows.forEach((show) => {
    if (!seen.has(show.id)) {
      seen.set(show.id, show);
    }
  });
  return Array.from(seen.values());
}

function mergeShowDetails(primary: ShowDetails, secondary: ShowDetails | null): ShowDetails {
  if (!secondary) return primary;

  return {
    ...secondary,
    ...primary,
    image: primary.image || secondary.image,
    summary: primary.summary || secondary.summary,
    premiered: primary.premiered || secondary.premiered,
    runtime: primary.runtime ?? secondary.runtime,
    rating: primary.rating?.average ? primary.rating : secondary.rating,
    genres: primary.genres?.length ? primary.genres : secondary.genres,
    status: primary.status || secondary.status,
    network: primary.network?.name ? primary.network : secondary.network,
    poster_url: primary.poster_url || secondary.poster_url,
    poster_path: primary.poster_path || secondary.poster_path,
    overview: primary.overview || secondary.overview || primary.summary || secondary.summary,
    release_date: primary.release_date || secondary.release_date || primary.premiered || secondary.premiered,
    language: primary.language || secondary.language,
    source: primary.source || secondary.source,
    tmdb_id: primary.tmdb_id ?? secondary.tmdb_id,
    tvmaze_id: primary.tvmaze_id ?? secondary.tvmaze_id ?? (secondary.source === "tvmaze" ? secondary.id : undefined),
    cast_details: primary.cast_details?.length ? primary.cast_details : secondary.cast_details,
    crew_details: primary.crew_details?.length ? primary.crew_details : secondary.crew_details,
  };
}

function mergeSearchResults(tmdbShows: ShowDetails[], tvmazeShows: ShowDetails[]): ShowDetails[] {
  const tvmazeByKey = new Map<string, ShowDetails>();
  tvmazeShows.forEach((show) => {
    const key = getShowIdentityKey(show);
    if (!tvmazeByKey.has(key)) {
      tvmazeByKey.set(key, show);
    }
  });

  const merged: ShowDetails[] = [];
  const consumedKeys = new Set<string>();

  tmdbShows.forEach((show) => {
    const key = getShowIdentityKey(show);
    consumedKeys.add(key);
    merged.push(mergeShowDetails(show, tvmazeByKey.get(key) || null));
  });

  tvmazeShows.forEach((show) => {
    const key = getShowIdentityKey(show);
    if (!consumedKeys.has(key)) {
      merged.push(show);
    }
  });

  return dedupeShows(merged);
}

function rankShows(shows: ShowDetails[], query: string): ShowDetails[] {
  const normalizedQuery = normalizeSearchText(normalizeShowSearchQuery(query));
  if (!normalizedQuery) return shows;

  return [...shows].sort((a, b) => {
    const score = (show: ShowDetails) => {
      const title = normalizeSearchText(show.title || show.name || "");
      let value = 0;

      if (title === normalizedQuery) value += 120;
      if (title.startsWith(normalizedQuery)) value += 80;
      if (title.includes(normalizedQuery)) value += 50;
      if (show.source === "tmdb") value += 20;

      value += (show.rating?.average || 0) * 4;
      value += Number.isFinite(show.runtime || 0) ? Math.min(show.runtime || 0, 60) * 0.15 : 0;

      return value;
    };

    return score(b) - score(a);
  });
}

function mapTMDBShow(result: TMDBTVSearchResult): ShowDetails {
  const poster = result.poster_path
    ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
    : result.backdrop_path
      ? `https://image.tmdb.org/t/p/w500${result.backdrop_path}`
      : null;

  return {
    id: TMDB_TV_ID_OFFSET + result.id,
    name: result.name,
    title: result.name,
    image: poster ? { medium: poster, original: poster } : undefined,
    summary: result.overview || "",
    premiered: result.first_air_date,
    runtime: result.episode_run_time?.[0],
    rating: typeof result.vote_average === "number" ? { average: result.vote_average } : undefined,
    genres: [],
    status: result.status,
    network: result.networks?.[0]?.name ? { name: result.networks[0].name } : undefined,
    type: "tv" as const,
    poster_url: poster || undefined,
    poster_path: poster || undefined,
    overview: result.overview || "",
    release_date: result.first_air_date,
    language: result.original_language || "en",
    source: "tmdb",
    tmdb_id: result.id,
    tvmaze_id: undefined,
  };
}

function mapTMDBShowDetails(show: TMDBTVDetails): ShowDetails {
  const poster = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : show.backdrop_path
      ? `https://image.tmdb.org/t/p/w500${show.backdrop_path}`
      : null;

  return {
    id: TMDB_TV_ID_OFFSET + show.id,
    name: show.name,
    title: show.name,
    image: poster ? { medium: poster, original: poster } : undefined,
    summary: show.overview || "",
    premiered: show.first_air_date,
    runtime: show.episode_run_time?.[0],
    rating: typeof show.vote_average === "number" ? { average: show.vote_average } : undefined,
    genres: show.genres?.map((genre) => genre.name) || [],
    status: show.status,
    network: show.networks?.[0]?.name ? { name: show.networks[0].name } : undefined,
    type: "tv" as const,
    poster_url: poster || undefined,
    poster_path: poster || undefined,
    overview: show.overview || "",
    release_date: show.first_air_date,
    language: show.original_language || "en",
    source: "tmdb",
    tmdb_id: show.id,
    tvmaze_id: undefined,
  };
}

function mapTVMazeCastCredit(credit: TVMazeCastCredit) {
  if (!credit?.person?.id || !credit.person.name) return null;
  return {
    id: credit.person.id,
    name: credit.person.name,
    profile_url: credit.person.image?.original || credit.person.image?.medium || null,
    character: credit.character?.name || null,
  };
}

function mapTVMazeCrewCredit(credit: TVMazeCrewCredit) {
  if (!credit?.person?.id || !credit.person.name) return null;
  return {
    id: credit.person.id,
    name: credit.person.name,
    profile_url: credit.person.image?.original || credit.person.image?.medium || null,
    job: credit.type || null,
    department: credit.type || null,
  };
}

function mapBrowseShow(show: TVMazeShow): ShowDetails {
  const poster = show.image?.original || show.image?.medium || null;

  return {
    id: show.id,
    name: show.name,
    title: show.name,
    image: show.image,
    summary: sanitizeShowSummary(show.summary),
    premiered: show.premiered,
    runtime: show.runtime,
    rating: show.rating,
    genres: show.genres || [],
    status: show.status,
    network: show.network,
    type: "tv" as const,
    poster_url: poster || undefined,
    poster_path: poster || undefined,
    overview: sanitizeShowSummary(show.summary),
    release_date: show.premiered,
    language: "en",
    source: "tvmaze",
    tvmaze_id: show.id,
    cast_details: [],
    crew_details: [],
  };
}

function scoreBrowseShow(show: ShowDetails, preferredGenres: string[]): number {
  const preferredSet = new Set(preferredGenres.map((genre) => normalizeSearchText(genre)).filter(Boolean));
  const showGenres = (show.genres || []).map((genre) => normalizeSearchText(genre));
  const genreHits = showGenres.filter((genre) => preferredSet.has(genre)).length;
  const rating = show.rating?.average || 0;
  const premieredYear = show.premiered ? new Date(show.premiered).getFullYear() : 0;

  let score = genreHits * 120;
  score += rating * 11;
  score += (show.runtime || 0) * 0.1;
  if (premieredYear && premieredYear >= 2010) {
    score += Math.min(30, premieredYear - 2009) * 2;
  }
  if (show.poster_url || show.image?.medium || show.image?.original) {
    score += 15;
  }

  return score;
}

export async function getSuggestedShowsByGenres(genres: string[], limit: number = 12): Promise<ShowDetails[]> {
  try {
    const normalizedGenres = Array.from(
      new Set(genres.map((genre) => normalizeSearchText(genre)).filter(Boolean))
    );
    const fallbackGenres = normalizedGenres.length > 0 ? normalizedGenres : ["drama", "crime", "thriller"];
    const cacheKey = getShowBrowseCacheKey(fallbackGenres);
    const cachedEntry = readBrowserCacheEntry<ShowDetails[]>(cacheKey);

    if (cachedEntry) {
      return (cachedEntry.value || []).slice(0, limit);
    }

    if (!showBrowseRefreshInFlight.has(cacheKey)) {
      const refreshPromise = (async () => {
        const pages = [0, 1];
        const pageResults = await Promise.all(
          pages.map(async (page) => {
            const response = await fetch(`${TVMAZE_BASE_URL}/shows?page=${page}`);
            if (!response.ok) return [];
            const data = (await response.json()) as TVMazeShow[];
            return data.map(mapBrowseShow);
          })
        );

        const ranked = dedupeShows(pageResults.flat())
          .sort((a, b) => scoreBrowseShow(b, fallbackGenres) - scoreBrowseShow(a, fallbackGenres))
          .slice(0, limit);

        writeBrowserCache(cacheKey, ranked, BROWSE_CACHE_TTL_MS);
        return ranked;
      })()
        .catch((error) => {
          console.error("TVMaze browse recommendation error:", error);
          return [] as ShowDetails[];
        })
        .finally(() => {
          showBrowseRefreshInFlight.delete(cacheKey);
        });

      showBrowseRefreshInFlight.set(cacheKey, refreshPromise);
    }

    return await showBrowseRefreshInFlight.get(cacheKey)!;
  } catch (error) {
    console.error("Error getting suggested shows:", error);
    return [];
  }
}

function mapTVMazeSearchShow(result: { show: TVMazeShow & { language?: string } }): ShowDetails {
  const show = result.show;
  return {
    id: show.id,
    name: show.name,
    title: show.name,
    image: show.image,
    summary: sanitizeShowSummary(show.summary),
    premiered: show.premiered,
    runtime: show.runtime,
    rating: show.rating,
    genres: show.genres || [],
    status: show.status,
    network: show.network,
    type: "tv" as const,
    poster_url: show.image?.original || show.image?.medium,
    poster_path: show.image?.original || show.image?.medium,
    overview: sanitizeShowSummary(show.summary),
    release_date: show.premiered,
    language: show.language || "en",
    source: "tvmaze",
    tvmaze_id: show.id,
  };
}

async function searchTVMazeShowsRaw(query: string): Promise<ShowDetails[]> {
  const response = await fetch(`${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("TVMaze search failed");
  }

  const data = (await response.json()) as Array<{ show: TVMazeShow & { language?: string } }>;
  return data.map(mapTVMazeSearchShow);
}

async function searchTMDBShowsRaw(query: string): Promise<ShowDetails[]> {
  const tmdbResponse = await fetchTmdb("search/tv", {
    query,
    page: 1,
  });

  if (!tmdbResponse.ok) {
    return [];
  }

  const tmdbData: TMDBTVSearchResponse = await tmdbResponse.json();
  return (tmdbData.results || []).map(mapTMDBShow);
}

function findBestShowMatchByTitle(results: ShowDetails[], titleHint: string, yearHint?: string): ShowDetails | null {
  const normalizedTitle = normalizeSearchText(titleHint);
  const normalizedYear = yearHint || "";

  const exactMatch = results.find((result) => {
    const sameTitle = normalizeSearchText(getShowTitle(result)) === normalizedTitle;
    if (!sameTitle) return false;
    return !normalizedYear || getShowYear(result) === normalizedYear;
  });

  if (exactMatch) return exactMatch;

  const sameYear = results.find((result) => normalizedYear && getShowYear(result) === normalizedYear);
  return sameYear || results[0] || null;
}

async function fetchTVMazeShowDetailsById(showId: number): Promise<ShowDetails | null> {
  const response = await fetch(`${TVMAZE_BASE_URL}/shows/${showId}`);
  if (!response.ok) return null;

  const show = (await response.json()) as TVMazeShow & { language?: string };
  const [castResult, crewResult] = await Promise.allSettled([
    fetch(`${TVMAZE_BASE_URL}/shows/${showId}/cast`),
    fetch(`${TVMAZE_BASE_URL}/shows/${showId}/crew`),
  ]);

  const castDetails: TVMazeMappedCreditPerson[] = [];
  if (castResult.status === "fulfilled" && castResult.value.ok) {
    const castCredits = (await castResult.value.json()) as TVMazeCastCredit[];
    for (const credit of castCredits) {
      const mapped = mapTVMazeCastCredit(credit);
      if (mapped) castDetails.push(mapped);
    }
  }

  const crewDetails: TVMazeMappedCreditPerson[] = [];
  if (crewResult.status === "fulfilled" && crewResult.value.ok) {
    const crewCredits = (await crewResult.value.json()) as TVMazeCrewCredit[];
    for (const credit of crewCredits) {
      const mapped = mapTVMazeCrewCredit(credit);
      if (mapped) crewDetails.push(mapped);
    }
  }

  return {
    id: show.id,
    name: show.name,
    title: show.name,
    image: show.image,
    summary: sanitizeShowSummary(show.summary),
    premiered: show.premiered,
    runtime: show.runtime,
    rating: show.rating,
    genres: show.genres || [],
    status: show.status,
    network: show.network,
    type: "tv" as const,
    poster_url: show.image?.original || show.image?.medium,
    poster_path: show.image?.original || show.image?.medium,
    overview: sanitizeShowSummary(show.summary),
    release_date: show.premiered,
    language: show.language || "en",
    source: "tvmaze",
    tvmaze_id: show.id,
    cast_details: castDetails,
    crew_details: crewDetails,
  };
}

async function fetchTMDBShowDetailsById(tmdbId: number): Promise<ShowDetails | null> {
  const tmdbResponse = await fetchTmdb(`tv/${tmdbId}`);
  if (!tmdbResponse.ok) return null;

  const tmdbData: TMDBTVDetails = await tmdbResponse.json();
  return mapTMDBShowDetails(tmdbData);
}

async function findBestTVMazeShowDetails(titleHint: string, yearHint?: string): Promise<ShowDetails | null> {
  const queries = Array.from(new Set(yearHint ? [`${titleHint} ${yearHint}`, titleHint] : [titleHint]));
  for (const query of queries) {
    const results = await searchTVMazeShowsRaw(query);
    const match = findBestShowMatchByTitle(results, titleHint, yearHint);
    if (match?.id) {
      return fetchTVMazeShowDetailsById(match.id);
    }
  }
  return null;
}

async function findBestTMDBShowDetails(titleHint: string, yearHint?: string): Promise<ShowDetails | null> {
  const queries = Array.from(new Set(yearHint ? [`${titleHint} ${yearHint}`, titleHint] : [titleHint]));
  for (const query of queries) {
    const results = await searchTMDBShowsRaw(query);
    const match = findBestShowMatchByTitle(results, titleHint, yearHint);
    const tmdbId = match?.tmdb_id ?? getTmdbLookupId(match?.id || 0);
    if (tmdbId) {
      return fetchTMDBShowDetailsById(tmdbId);
    }
  }
  return null;
}

export async function searchShows(query: string): Promise<ShowDetails[]> {
  try {
    const trimmedQuery = normalizeShowSearchQuery(query);
    if (!trimmedQuery) return [];

    const cacheKey = getShowSearchCacheKey(trimmedQuery);
    const cachedEntry = readBrowserCacheEntry<ShowDetails[]>(cacheKey);
    if (cachedEntry) {
      const cached = cachedEntry.value ?? [];
      if (!showSearchRefreshInFlight.has(cacheKey)) {
        const refreshPromise = (async () => {
          const [tvmazeShows, tmdbShows] = await Promise.all([
            searchTVMazeShowsRaw(trimmedQuery).catch(() => []),
            searchTMDBShowsRaw(trimmedQuery).catch(() => []),
          ]);

          return rankShows(mergeSearchResults(tmdbShows, tvmazeShows), trimmedQuery);
        })()
          .then((fresh) => {
            writeBrowserCache(cacheKey, fresh, SEARCH_CACHE_TTL_MS);
            return fresh;
          })
          .catch((error) => {
            console.error("TVMaze search refresh error:", error);
            return cached;
          })
          .finally(() => {
            showSearchRefreshInFlight.delete(cacheKey);
          });

        showSearchRefreshInFlight.set(cacheKey, refreshPromise);
      }

      return cached;
    }

    const [tvmazeShows, tmdbShows] = await Promise.all([
      searchTVMazeShowsRaw(trimmedQuery).catch(() => []),
      searchTMDBShowsRaw(trimmedQuery).catch(() => []),
    ]);

    const results = rankShows(mergeSearchResults(tmdbShows, tvmazeShows), trimmedQuery);
    writeBrowserCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error("Error searching shows:", error);
    return [];
  }
}

export async function getShowDetails(showId: number): Promise<ShowDetails | null> {
  try {
    const tmdbLookupId = getTmdbLookupId(showId);
    if (tmdbLookupId) {
      const tmdbShow = await fetchTMDBShowDetailsById(tmdbLookupId);
      if (tmdbShow) {
        const tvmazeMatch = await findBestTVMazeShowDetails(
          tmdbShow.title || tmdbShow.name,
          getShowYear(tmdbShow)
        ).catch(() => null);

        return mergeShowDetails(tmdbShow, tvmazeMatch);
      }
    }

    const tvmazeShow = await fetchTVMazeShowDetailsById(showId);
    if (!tvmazeShow) {
      const fallbackTmdbId = tmdbLookupId ?? showId;
      const fallbackTmdbShow = await fetchTMDBShowDetailsById(fallbackTmdbId);
      return fallbackTmdbShow;
    }

    const tmdbMatch = await findBestTMDBShowDetails(
      tvmazeShow.title || tvmazeShow.name,
      getShowYear(tvmazeShow)
    ).catch(() => null);

    return mergeShowDetails(tvmazeShow, tmdbMatch);
  } catch {
    try {
      const tvmazeShow = await fetchTVMazeShowDetailsById(showId);
      if (tvmazeShow) {
        return tvmazeShow;
      }

      const tmdbId = getTmdbLookupId(showId) ?? showId;
      return await fetchTMDBShowDetailsById(tmdbId);
    } catch {
      return null;
    }
  }
}
