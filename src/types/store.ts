// Types for the Canisterr 3D Movie Store (/store).
// Kept separate from src/types/index.ts since these describe store-specific
// shelf/scene configuration rather than core domain models.

export type StoreSectionKind = "genre" | "collection" | "personalized";

export type SectionMood = "neutral" | "dark" | "cool" | "warm" | "vibrant" | "vintage";

export type DiscoverSortBy =
  | "popularity.desc"
  | "vote_average.desc"
  | "release_date.desc"
  | "primary_release_date.desc"
  | "primary_release_date.asc"
  | "revenue.desc";

/**
 * Whitelisted TMDB /discover/movie parameters a shelf is allowed to request.
 * Anything outside this shape is dropped before it reaches fetchTmdb.
 */
export interface DiscoverShelfQuery {
  kind: "discover";
  with_genres?: number[];
  /** "and" (comma, default) requires every genre; "or" (pipe) blends genres — used by mood collections like Date Night. */
  genreLogic?: "and" | "or";
  without_genres?: number[];
  sort_by?: DiscoverSortBy;
  voteCountGte?: number;
  voteAverageGte?: number;
  releaseDateGte?: string;
  releaseDateLte?: string;
  withOriginalLanguage?: string;
  runtimeGte?: number;
  runtimeLte?: number;
  page?: number;
}

/** A hand-picked, editorially-fixed shelf (e.g. Staff Picks). Empty-safe. */
export interface StaticShelfQuery {
  kind: "static";
  ids: number[];
}

/** TMDB's dedicated trending/popular endpoints (distinct from /discover). */
export interface CatalogShelfQuery {
  kind: "catalog";
  source: "trending_day" | "trending_week" | "popular";
}

export type ShelfQuery = DiscoverShelfQuery | StaticShelfQuery | CatalogShelfQuery;

export interface ShelfDefinition {
  id: string;
  label: string;
  query: ShelfQuery;
}

export interface StoreSectionConfig {
  id: string;
  kind: StoreSectionKind;
  label: string;
  signage: string;
  mood: SectionMood;
  shelves: ShelfDefinition[];
}

/** Lightweight movie summary used to populate 3D shelves (cheap to fetch/hold many of). */
export interface StoreMovieSummary {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  releaseYear: number | null;
  rating: number | null;
  /** Pre-resolved CDN URLs, used when a shelf source (e.g. getMovieDetails) already returns full URLs instead of raw paths. */
  posterUrl?: string | null;
  backdropUrl?: string | null;
}

/** A personalized section backed by a real Canisterr data function (never fabricated). */
export interface PersonalizedSectionConfig {
  id: string;
  label: string;
  signage: string;
  mood: SectionMood;
  description: string;
  fetch: (userId: string) => Promise<StoreMovieSummary[]>;
}

export type QualityTier = "performance" | "balanced" | "high";

export type StoreViewMode = "3d" | "simple";

/** Computed world-space placement for a section, produced by the layout engine. */
export interface StoreSectionAnchor {
  sectionId: string;
  position: [number, number, number];
  rotationY: number;
  width: number;
  depth: number;
}

export interface AabbCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
