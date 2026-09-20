import { fetchTmdb } from "@/lib/tmdb-transport";
import { TMDB_TV_ID_OFFSET } from "@/lib/tvmaze";
import { getMoodDefinition } from "./moods";
import type { CandidateGenerationInput, RecommendationCandidate } from "./types";

interface TmdbDiscoverItem {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
  original_language?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

interface TmdbDiscoverResponse {
  results?: TmdbDiscoverItem[];
}

interface TmdbTvDiscoverItem {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  original_language?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
}

interface TmdbTvDiscoverResponse {
  results?: TmdbTvDiscoverItem[];
}

interface TmdbMovieDetails {
  id: number;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  credits?: { crew?: Array<{ job?: string; name?: string }> };
  "watch/providers"?: {
    results?: Record<string, { flatrate?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] }>;
  };
}

interface TmdbTvDetails {
  id: number;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  created_by?: Array<{ name?: string }>;
  "watch/providers"?: TmdbMovieDetails["watch/providers"];
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function candidateKey(type: "movie" | "tv", id: number): string {
  return `${type}:${id}`;
}

function getMovieAvailability(
  details: { "watch/providers"?: TmdbMovieDetails["watch/providers"] } | null,
  region: string
) {
  const regionData = details?.["watch/providers"]?.results?.[region];
  const providers = [...(regionData?.flatrate || []), ...(regionData?.rent || []), ...(regionData?.buy || [])];
  return {
    ids: unique(providers.map((provider) => provider.provider_id)),
    names: unique(providers.map((provider) => provider.provider_name)),
  };
}

async function fetchMovieCandidates(input: CandidateGenerationInput, limit: number): Promise<RecommendationCandidate[]> {
  const mood = getMoodDefinition(input.context.mood);
  const runtimeLimit = input.context.availableMinutes && input.context.availableMinutes >= 70
    ? input.context.availableMinutes
    : undefined;
  const response = await fetchTmdb("discover/movie", {
    page: input.page || 1,
    include_adult: false,
    include_video: false,
    sort_by: input.context.noveltyLevel > 0.68 ? "vote_average.desc" : "popularity.desc",
    "vote_count.gte": input.context.noveltyLevel > 0.68 ? 80 : 180,
    "vote_average.gte": 5.8,
    with_genres: mood?.genreIds.join("|") || undefined,
    "with_runtime.lte": runtimeLimit,
    watch_region: input.context.region,
    with_watch_providers: input.context.providerIds.length ? input.context.providerIds.join("|") : undefined,
  });
  if (!response.ok) return [];

  const data = (await response.json()) as TmdbDiscoverResponse;
  const movies = (data.results || [])
    .filter((movie) => Boolean(movie.poster_path))
    .filter((movie) => !input.excludedKeys.has(candidateKey("movie", movie.id)))
    .slice(0, limit);

  const details = await Promise.all(movies.map(async (movie) => {
    try {
      const detailResponse = await fetchTmdb(`movie/${movie.id}`, { append_to_response: "credits,watch/providers" });
      return detailResponse.ok ? (await detailResponse.json()) as TmdbMovieDetails : null;
    } catch {
      return null;
    }
  }));

  return movies.map((movie, index) => {
    const detail = details[index];
    const availability = getMovieAvailability(detail, input.context.region);
    return {
      id: movie.id,
      contentType: "movie",
      title: movie.title,
      overview: movie.overview || "",
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdropUrl: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      releaseDate: movie.release_date || null,
      runtimeMinutes: detail?.runtime || null,
      genres: detail?.genres?.map((genre) => genre.name) || [],
      genreIds: detail?.genres?.map((genre) => genre.id) || movie.genre_ids || [],
      language: movie.original_language || null,
      creator: detail?.credits?.crew?.find((person) => person.job === "Director")?.name || null,
      rating: movie.vote_average ?? null,
      voteCount: movie.vote_count ?? null,
      popularity: movie.popularity ?? null,
      providerIds: availability.ids,
      providerNames: availability.names,
      source: "tmdb",
    };
  });
}

async function fetchTvCandidates(input: CandidateGenerationInput, limit: number): Promise<RecommendationCandidate[]> {
  const mood = getMoodDefinition(input.context.mood);
  const response = await fetchTmdb("discover/tv", {
    page: input.page || 1,
    include_adult: false,
    sort_by: input.context.noveltyLevel > 0.68 ? "vote_average.desc" : "popularity.desc",
    "vote_count.gte": input.context.noveltyLevel > 0.68 ? 60 : 120,
    "vote_average.gte": 5.8,
    with_genres: mood?.genreIds.join("|") || undefined,
    watch_region: input.context.region,
    with_watch_providers: input.context.providerIds.length ? input.context.providerIds.join("|") : undefined,
  });
  if (!response.ok) return [];

  const data = (await response.json()) as TmdbTvDiscoverResponse;
  const shows = (data.results || [])
    .filter((show) => Boolean(show.poster_path))
    .filter((show) => !input.excludedKeys.has(candidateKey("tv", TMDB_TV_ID_OFFSET + show.id)))
    .slice(0, limit);
  const details = await Promise.all(shows.map(async (show) => {
    try {
      const detailResponse = await fetchTmdb(`tv/${show.id}`, { append_to_response: "watch/providers" });
      return detailResponse.ok ? (await detailResponse.json()) as TmdbTvDetails : null;
    } catch {
      return null;
    }
  }));

  return shows.map((show, index) => {
    const detail = details[index];
    const availability = getMovieAvailability(detail, input.context.region);
    return {
      id: TMDB_TV_ID_OFFSET + show.id,
      contentType: "tv" as const,
      title: show.name,
      overview: show.overview || "",
      posterUrl: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
      backdropUrl: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null,
      releaseDate: show.first_air_date || null,
      runtimeMinutes: detail?.episode_run_time?.find((runtime) => runtime > 0) || null,
      genres: detail?.genres?.map((genre) => genre.name) || [],
      genreIds: detail?.genres?.map((genre) => genre.id) || show.genre_ids || [],
      language: show.original_language || null,
      creator: detail?.created_by?.[0]?.name || null,
      rating: show.vote_average ?? null,
      voteCount: show.vote_count ?? null,
      popularity: show.popularity ?? null,
      providerIds: availability.ids,
      providerNames: availability.names,
      source: "tmdb" as const,
    };
  }).filter((show) => !input.context.availableMinutes || !show.runtimeMinutes || show.runtimeMinutes <= input.context.availableMinutes);
}

export async function generateCandidates(input: CandidateGenerationInput): Promise<RecommendationCandidate[]> {
  const wantsMovies = input.context.contentType !== "tv";
  const wantsTv = input.context.contentType !== "movie";
  const [movies, shows] = await Promise.all([
    wantsMovies ? fetchMovieCandidates(input, input.context.contentType === "either" ? 12 : 20) : Promise.resolve([]),
    wantsTv ? fetchTvCandidates(input, input.context.contentType === "either" ? 10 : 20) : Promise.resolve([]),
  ]);
  return [...movies, ...shows];
}
