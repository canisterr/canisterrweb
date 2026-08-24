import { fetchTmdb } from "@/lib/tmdb-transport";
import type { TMDBSearchResponse } from "@/types";
import type { CandidateFetchInput, DiscoveryMovie, MovieProviderAvailability } from "./discoveryTypes";
import { getMoodDefinition } from "./moodMapping";

type KeywordSearchResponse = {
  results?: Array<{ id: number; name: string }>;
};

type MovieDetailsResponse = {
  id: number;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  keywords?: {
    keywords?: Array<{ id: number; name: string }>;
  };
  "watch/providers"?: {
    results?: Record<
      string,
      {
        flatrate?: Array<{ provider_id: number; provider_name: string }>;
        rent?: Array<{ provider_id: number; provider_name: string }>;
        buy?: Array<{ provider_id: number; provider_name: string }>;
      }
    >;
  };
};

function uniqueNumbers(ids: number[]) {
  return Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
}

function getEraParams(era: CandidateFetchInput["filters"]["era"]) {
  const currentYear = new Date().getFullYear();
  if (era === "recent") {
    return { "primary_release_date.gte": `${currentYear - 5}-01-01` };
  }
  if (era === "2010s") {
    return { "primary_release_date.gte": "2010-01-01" };
  }
  if (era === "classics") {
    return { "primary_release_date.lte": "1999-12-31" };
  }
  return {};
}

function getRuntimeLimit(runtime: CandidateFetchInput["filters"]["runtime"]) {
  if (runtime === "under90") return 90;
  if (runtime === "under120") return 120;
  return undefined;
}

async function resolveKeywordIds(terms: string[]): Promise<number[]> {
  const limitedTerms = terms.slice(0, 14);
  const entries = await Promise.all(
    limitedTerms.map(async (term) => {
      try {
        const response = await fetchTmdb("search/keyword", { query: term, page: 1 });
        if (!response.ok) return null;
        const data = (await response.json()) as KeywordSearchResponse;
        return data.results?.[0]?.id || null;
      } catch {
        return null;
      }
    })
  );
  return uniqueNumbers(entries.filter((id): id is number => typeof id === "number"));
}

function getAvailability(details: MovieDetailsResponse, region: string): MovieProviderAvailability {
  const regionData = details["watch/providers"]?.results?.[region];
  const providers = [...(regionData?.flatrate || []), ...(regionData?.rent || []), ...(regionData?.buy || [])];
  const providerIds = uniqueNumbers(providers.map((provider) => provider.provider_id));
  const providerNames = Array.from(new Set(providers.map((provider) => provider.provider_name)));
  return { providerIds, providerNames };
}

function moodTagsForMovie(movie: DiscoveryMovie, moodGenreNames: Map<number, string>) {
  const genreIds = movie.genre_ids || movie.genres || [];
  const tags = genreIds.map((id) => moodGenreNames.get(id)).filter((name): name is string => Boolean(name));
  if ((movie.runtime || 0) > 0 && (movie.runtime || 0) <= 100) tags.push("Quick watch");
  if ((movie.vote_average || 0) >= 7.4) tags.push("Well loved");
  return Array.from(new Set(tags)).slice(0, 3);
}

export async function fetchDiscoveryCandidates(input: CandidateFetchInput): Promise<DiscoveryMovie[]> {
  const mood = getMoodDefinition(input.mood);
  const primaryGenreIds = mood.genres.filter((genre) => genre.priority === "primary").map((genre) => genre.id);
  const secondaryGenreIds = mood.genres.filter((genre) => genre.priority === "secondary").map((genre) => genre.id);
  const keywordIds = await resolveKeywordIds(mood.keywordTerms);
  const runtimeLimit = getRuntimeLimit(input.filters.runtime);
  const excludedIds = new Set(input.excludedIds || []);

  const baseParams: Record<string, string | number | boolean | undefined> = {
    page: input.page || 1,
    include_adult: false,
    include_video: false,
    sort_by: "popularity.desc",
    "vote_count.gte": 120,
    "vote_average.gte": 5.8,
    with_genres: [...primaryGenreIds, ...secondaryGenreIds].join("|"),
    with_original_language: input.filters.language,
    region: input.region,
    watch_region: input.region,
    with_watch_providers: input.providerIds.length > 0 ? input.providerIds.join("|") : undefined,
    "with_runtime.lte": runtimeLimit,
    ...getEraParams(input.filters.era),
  };

  const keywordParams = keywordIds.length > 0 ? { ...baseParams, with_keywords: keywordIds.slice(0, 8).join("|") } : baseParams;
  const responses = await Promise.all([
    fetchTmdb("discover/movie", keywordParams),
    fetchTmdb("discover/movie", { ...baseParams, with_genres: primaryGenreIds.join("|"), page: (input.page || 1) + 1 }),
  ]);

  const resultSets = await Promise.all(
    responses.map(async (response) => {
      if (!response.ok) return [];
      const data = (await response.json()) as TMDBSearchResponse;
      return data.results || [];
    })
  );

  const rawMovies = Array.from(new Map(resultSets.flat().map((movie) => [movie.id, movie])).values())
    .filter((movie) => !excludedIds.has(movie.id))
    .filter((movie) => Boolean(movie.poster_path))
    .slice(0, 30);

  const details = await Promise.all(
    rawMovies.map(async (movie) => {
      try {
        const response = await fetchTmdb(`movie/${movie.id}`, {
          append_to_response: "keywords,watch/providers",
        });
        if (!response.ok) return null;
        return (await response.json()) as MovieDetailsResponse;
      } catch {
        return null;
      }
    })
  );

  const moodGenreNames = new Map(mood.genres.map((genre) => [genre.id, genre.name]));

  return rawMovies.map((movie, index) => {
    const detail = details[index];
    const detailGenreIds = detail?.genres?.map((genre) => genre.id) || movie.genre_ids || movie.genres || [];
    const candidate: DiscoveryMovie = {
      ...movie,
      genres: detailGenreIds,
      genre_ids: detailGenreIds,
      runtime: detail?.runtime || movie.runtime || 0,
      keywordIds: detail?.keywords?.keywords?.map((keyword) => keyword.id) || [],
      providerAvailability: detail ? getAvailability(detail, input.region) : undefined,
      moodTags: [],
      director: movie.director || null,
    };
    candidate.moodTags = moodTagsForMovie(candidate, moodGenreNames);
    return candidate;
  });
}
