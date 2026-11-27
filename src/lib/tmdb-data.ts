import type { TMDBMovie, TMDBSearchResponse } from "@/types";
import { fetchTmdb } from "./tmdb-transport";

type TmdbParams = Record<string, string | number | boolean | null | undefined>;

export class TmdbRequestError extends Error {
  constructor(public readonly status: number, path: string) {
    super(`TMDB ${path} returned ${status}`);
  }
}

export async function getTmdbData<T>(path: string, params?: TmdbParams): Promise<T> {
  const response = await fetchTmdb(path, params);
  if (!response.ok) throw new TmdbRequestError(response.status, path);
  return (await response.json()) as T;
}

export async function searchTmdbMovies(
  query: string,
  options: { page?: number; year?: number; language?: string } = {}
): Promise<TMDBSearchResponse> {
  return getTmdbData<TMDBSearchResponse>("search/movie", {
    query,
    page: options.page ?? 1,
    primary_release_year: options.year,
    language: options.language,
  });
}

export async function getTmdbMovie(id: number, appendToResponse?: string): Promise<TMDBMovie> {
  return getTmdbData<TMDBMovie>(`movie/${id}`, {
    append_to_response: appendToResponse,
  });
}

export async function getTmdbPopularMovies(page = 1): Promise<TMDBSearchResponse> {
  return getTmdbData<TMDBSearchResponse>("movie/popular", { page });
}

export async function getTmdbTrendingMovies(window: "day" | "week" = "day", page = 1): Promise<TMDBSearchResponse> {
  return getTmdbData<TMDBSearchResponse>(`trending/movie/${window}`, { page });
}

export async function getTmdbMovieGenres(): Promise<{ genres: Array<{ id: number; name: string }> }> {
  return getTmdbData("genre/movie/list");
}
