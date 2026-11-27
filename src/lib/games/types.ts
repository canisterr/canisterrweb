export const GAME_CATEGORIES = [
  { id: "english", label: "English · Hollywood", language: "en", country: "US" },
  { id: "hi", label: "Hindi · Bollywood", language: "hi", country: "IN" },
  { id: "te", label: "Telugu · Tollywood", language: "te", country: "IN" },
  { id: "ml", label: "Malayalam · Mollywood", language: "ml", country: "IN" },
  { id: "ta", label: "Tamil · Kollywood", language: "ta", country: "IN" },
  { id: "korean", label: "Korean cinema", language: "ko", country: "KR" },
  { id: "french", label: "French cinema", language: "fr", country: "FR" },
] as const;

export type GameCategoryId = (typeof GAME_CATEGORIES)[number]["id"];
export type GameKind = "reveal" | "connection" | "grid";

export type GameTitle = {
  key: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle: string;
  aliases: string[];
  originalLanguage: string;
  productionCountries: string[];
  releaseDate: string;
  genres: string[];
  runtime: number | null;
  seasons: number | null;
  cast: Array<{ id: number; name: string; popularity: number; profilePath: string | null }>;
  directorOrCreator: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
  voteCount: number;
  voteAverage?: number;
  updatedAt: number;
};

export type PublicDailyGame = {
  id: string;
  category: GameCategoryId;
  kind: "reveal" | "connection";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  genres: string[];
  runtime: number | null;
  seasons: number | null;
  directorOrCreator: string | null;
  leadCast: string | null;
  firstClue?: string | null;
  pair?: Array<{ tmdbId?: number; title: string; posterPath: string | null; mediaType: "movie" | "tv" }>;
  answer?: never;
};

export function classifyGameTitle(title: Pick<GameTitle, "originalLanguage" | "productionCountries">): GameCategoryId[] {
  const languages = title.originalLanguage.toLowerCase();
  const categories: GameCategoryId[] = [];
  if (languages === "en") categories.push("english");
  if (languages === "hi" || languages === "te" || languages === "ml" || languages === "ta") categories.push(languages);
  if (languages === "ko") categories.push("korean");
  if (languages === "fr") categories.push("french");
  return categories;
}

export function normalizeGameAnswer(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesGameAnswer(guess: string, accepted: string[]): boolean {
  const normalized = normalizeGameAnswer(guess);
  return normalized.length >= 2 && accepted.some((answer) => normalizeGameAnswer(answer) === normalized);
}

export function utcGameDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

