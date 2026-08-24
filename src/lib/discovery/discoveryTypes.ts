import type { TMDBMovie } from "@/types";

export type DiscoveryMoodSlug =
  | "comfort"
  | "lonely_reflective"
  | "romantic"
  | "feel_good_funny"
  | "adrenaline"
  | "mind_bending"
  | "dark_twisted"
  | "emotional_cry"
  | "beautiful_dreamy"
  | "epic_immersive";

export type GenrePriority = "primary" | "secondary";

export type RuntimeFilter = "any" | "under90" | "under120";
export type EraFilter = "any" | "recent" | "2010s" | "classics";

export type DiscoveryAction = "pass" | "interested" | "watchlist";

export type DiscoveryFilters = {
  runtime: RuntimeFilter;
  era: EraFilter;
  language?: string;
};

export type MoodGenre = {
  id: number;
  name: string;
  priority: GenrePriority;
};

export type MoodDefinition = {
  slug: DiscoveryMoodSlug;
  name: string;
  reason: string;
  genres: MoodGenre[];
  keywordTerms: string[];
};

export type WatchProvider = {
  id: number;
  name: string;
  logoPath: string | null;
  displayPriority?: number;
};

export type MovieProviderAvailability = {
  providerIds: number[];
  providerNames: string[];
};

export type DiscoveryMovie = TMDBMovie & {
  moodTags: string[];
  providerAvailability?: MovieProviderAvailability;
  keywordIds?: number[];
};

export type DiscoverySwipe = {
  movieId: number;
  action: DiscoveryAction;
  genres: number[];
  runtime?: number;
  releaseYear?: number;
  providerIds?: number[];
  keywordIds?: number[];
};

export type SessionTaste = {
  likedGenres: Record<number, number>;
  dislikedGenres: Record<number, number>;
  likedKeywords: Record<number, number>;
  dislikedKeywords: Record<number, number>;
  longRuntimePasses: number;
  totalSwipes: number;
};

export type CandidateFetchInput = {
  mood: DiscoveryMoodSlug;
  providerIds: number[];
  region: string;
  filters: DiscoveryFilters;
  page?: number;
  excludedIds?: number[];
};
