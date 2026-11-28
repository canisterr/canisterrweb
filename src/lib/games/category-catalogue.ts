import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { fetchTmdb } from "@/lib/tmdb-transport";
import { GAME_CATEGORIES, hasDocumentaryGenre, isDocumentaryGameTitle, utcGameDate, type GameCategoryId, type GameTitle } from "./types";

type MovieDetails = {
  credits?: { cast?: Array<Record<string, unknown>>; crew?: Array<Record<string, unknown>> };
  alternative_titles?: { titles?: Array<Record<string, unknown>> };
  production_countries?: Array<Record<string, unknown>>;
  origin_country?: string[];
  genres?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

function text(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function number(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }

export async function expandGameCategoryCatalogue(category: GameCategoryId, existing: GameTitle[]): Promise<GameTitle[]> {
  const config = GAME_CATEGORIES.find((item) => item.id === category);
  if (!config?.language) return existing;
  const discover = await fetchTmdb("discover/movie", {
    sort_by: "vote_average.desc", "vote_count.gte": 100,
    "primary_release_date.lte": utcGameDate(),
    without_genres: 99,
    with_original_language: config.language,
    ...(config.country ? { with_origin_country: config.country } : {}), page: 1,
  });
  if (!discover.ok) return existing;
  const payload = await discover.json() as { results?: Array<Record<string, unknown>> };
  const rows = (payload.results || []).slice(0, 12).map((row) => ({ mediaType: "movie" as const, row }));
  const additions = await Promise.all(rows.map(async ({ mediaType, row }): Promise<GameTitle | null> => {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id < 1) return null;
    const key = `${mediaType}_${id}`;
    const cached = existing.find((title) => title.key === key);
    if (cached?.cast?.length && cached.genres?.length && !isDocumentaryGameTitle(cached)) return cached;
    const response = await fetchTmdb(`${mediaType}/${id}`, { append_to_response: "credits,alternative_titles" });
    if (!response.ok) return cached && !isDocumentaryGameTitle(cached) ? cached : null;
    const raw = await response.json() as MovieDetails;
    if (hasDocumentaryGenre(raw.genres)) return null;
    const credits = raw.credits || {};
    const cast = (credits.cast || []).slice(0, 12).map((person) => ({
      id: number(person.id), name: text(person.name), popularity: number(person.popularity),
      profilePath: text(person.profile_path) || null,
    })).filter((person: GameTitle["cast"][number]) => person.name && Number.isFinite(person.id));
    const otherTitles = raw.alternative_titles?.titles;
    const aliases = (otherTitles || []).map((item) => item.title).filter((value): value is string => typeof value === "string");
    const crew = Array.isArray(credits.crew) ? credits.crew : [];
    const creator = crew.find((person) => person.job === "Director")?.name;
    const directorOrCreator = typeof creator === "string" ? creator : null;
    const releaseDate = text(raw.release_date);
    return {
      key, tmdbId: id, mediaType,
      title: text(raw.title),
      originalTitle: text(raw.original_title, text(raw.title)),
      aliases: [...new Set([...aliases, raw.original_title, raw.original_name].filter((value): value is string => typeof value === "string" && value.length > 0))],
      originalLanguage: text(raw.original_language, config.language),
      productionCountries: [...(raw.production_countries || []).map((country) => text(country.iso_3166_1)), ...(raw.origin_country || [])].filter(Boolean),
      releaseDate,
      genres: (raw.genres || []).map((genre) => text(genre.name)).filter(Boolean),
      productionCompanies: (Array.isArray(raw.production_companies) ? raw.production_companies : []).map((company) => text(company.name)).filter(Boolean),
      runtime: typeof raw.runtime === "number" ? raw.runtime : null,
      seasons: null,
      cast, directorOrCreator,
      posterPath: typeof raw.poster_path === "string" ? raw.poster_path : null,
      backdropPath: typeof raw.backdrop_path === "string" ? raw.backdrop_path : null,
      popularity: number(raw.popularity, number(row.popularity)), voteCount: number(raw.vote_count, number(row.vote_count)), voteAverage: number(raw.vote_average, number(row.vote_average)), updatedAt: Date.now(),
    };
  }));
  const documentaryKeys = existing.filter(isDocumentaryGameTitle).map((title) => title.key);
  if (documentaryKeys.length) {
    const removals = Object.fromEntries(documentaryKeys.map((key) => [key, null]));
    await getFirebaseAdminDatabase().ref("games/catalogue").update(removals);
  }
  const merged = new Map(existing.filter((title) => !isDocumentaryGameTitle(title)).map((title) => [title.key, title]));
  const updates: Record<string, GameTitle> = {};
  for (const title of additions) if (title?.title) { merged.set(title.key, title); updates[title.key] = title; }
  if (Object.keys(updates).length) await getFirebaseAdminDatabase().ref("games/catalogue").update(updates);
  return [...merged.values()];
}
