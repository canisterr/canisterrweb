import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { fetchTmdb } from "@/lib/tmdb-transport";
import { classifyGameTitle, GAME_CATEGORIES, normalizeGameAnswer, utcGameDate, type GameCategoryId, type GameTitle } from "@/lib/games/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CATEGORY_GENRES: Record<number, string> = {
  12: "Adventure", 14: "Fantasy", 16: "Animation", 18: "Drama", 27: "Horror", 28: "Action",
  35: "Comedy", 36: "History", 37: "Western", 53: "Thriller", 80: "Crime", 99: "Documentary",
  878: "Science fiction", 9648: "Mystery", 10402: "Music", 10749: "Romance", 10751: "Family",
  10752: "War", 10759: "Action & adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-fi & fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & politics", 10770: "TV movie",
};

function getSeedCategory(date: string) {
  const categoryCycle = GAME_CATEGORIES.filter((category) => category.language && category.country);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return categoryCycle[((day % categoryCycle.length) + categoryCycle.length) % categoryCycle.length];
}

async function readJson(path: string, params: Record<string, string | number>) {
  const response = await fetchTmdb(path, params);
  if (!response.ok) throw new Error(`TMDB returned ${response.status} for ${path}`);
  return await response.json() as Record<string, any>;
}

function mapDetails(mediaType: "movie" | "tv", raw: Record<string, any>): GameTitle {
  const credits = raw.credits || {};
  const cast = (credits.cast || []).slice(0, 12).map((person: Record<string, any>) => ({
    id: Number(person.id), name: String(person.name || ""), popularity: Number(person.popularity || 0),
    profilePath: typeof person.profile_path === "string" ? person.profile_path : null,
  })).filter((person: GameTitle["cast"][number]) => person.name && Number.isFinite(person.id));
  const crew = credits.crew || [];
  const director = mediaType === "movie"
    ? crew.find((person: Record<string, unknown>) => person.job === "Director")?.name
    : (raw.created_by || []).map((person: Record<string, unknown>) => person.name).filter(Boolean).join(", ");
  const aliases = mediaType === "movie"
    ? (raw.alternative_titles?.titles || []).map((item: Record<string, any>) => item.title)
    : (raw.alternative_titles?.results || []).map((item: Record<string, any>) => item.title);
  const genres = (raw.genres || []).map((genre: Record<string, any>) => genre.name).filter(Boolean);
  const releaseDate = String(mediaType === "movie" ? raw.release_date || "" : raw.first_air_date || "");
  return {
    key: `${mediaType}_${Number(raw.id)}`, tmdbId: Number(raw.id), mediaType,
    title: String(mediaType === "movie" ? raw.title || "" : raw.name || ""),
    originalTitle: String(mediaType === "movie" ? raw.original_title || raw.title || "" : raw.original_name || raw.name || ""),
    aliases: [...new Set([...(aliases as string[]), raw.original_title, raw.original_name].filter((value): value is string => typeof value === "string" && value.length > 0))],
    originalLanguage: String(raw.original_language || ""),
    productionCountries: [...(raw.production_countries || []).map((country: any) => String(country.iso_3166_1 || "")), ...(raw.origin_country || [])].filter(Boolean),
    releaseDate, genres, runtime: mediaType === "movie" && typeof raw.runtime === "number" ? raw.runtime : null,
    seasons: mediaType === "tv" && typeof raw.number_of_seasons === "number" ? raw.number_of_seasons : null,
    cast, directorOrCreator: typeof director === "string" ? director : null,
    posterPath: typeof raw.poster_path === "string" ? raw.poster_path : null,
    backdropPath: typeof raw.backdrop_path === "string" ? raw.backdrop_path : null,
    popularity: Number(raw.popularity || 0), voteCount: Number(raw.vote_count || 0), voteAverage: Number(raw.vote_average || 0), updatedAt: Date.now(),
  };
}

function movieFallback(mediaType: "movie" | "tv", item: Record<string, any>, country: string): GameTitle {
  const title = String(item.title || item.name || "");
  const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  return {
    key: `${mediaType}_${Number(item.id)}`, tmdbId: Number(item.id), mediaType, title,
    originalTitle: String(item.original_title || item.original_name || title), aliases: [],
    originalLanguage: String(item.original_language || ""), productionCountries: [country],
    releaseDate: String(item.release_date || item.first_air_date || ""),
    genres: genreIds.map((id: number) => CATEGORY_GENRES[id]).filter(Boolean),
    runtime: null, seasons: null, cast: [], directorOrCreator: null,
    posterPath: typeof item.poster_path === "string" ? item.poster_path : null,
    backdropPath: typeof item.backdrop_path === "string" ? item.backdrop_path : null,
    popularity: Number(item.popularity || 0), voteCount: Number(item.vote_count || 0), voteAverage: Number(item.vote_average || 0), updatedAt: Date.now(),
  };
}

function dailyReveal(title: GameTitle, category: GameCategoryId, date: string) {
  const year = title.releaseDate.slice(0, 4);
  const lead = title.cast[0]?.name || null;
  const clues = [
    title.genres.length ? `Its genres include ${title.genres.slice(0, 2).join(" and ").toLowerCase()}.` : "It is a feature film.",
    title.runtime ? `It runs for about ${Math.round(title.runtime / 10) * 10} minutes.` : "It was released before today.",
    year ? `Released in ${year}.` : "Think about the decade.",
    title.directorOrCreator ? `Directed or created by ${title.directorOrCreator}.` : "Think about who made it.",
    lead ? `Featuring ${lead}.` : "A lead performer appears in another popular title.",
    "Poster clue unlocked.",
  ];
  return {
    category, kind: "reveal", answer: title.title,
    acceptedAnswers: [...new Set([title.title, title.originalTitle, ...title.aliases].filter(Boolean))],
    answerTmdbId: title.tmdbId, answerMediaType: title.mediaType, answerPosterPath: title.posterPath,
    posterPath: title.posterPath, backdropPath: title.backdropPath, releaseDate: title.releaseDate,
    genres: title.genres, runtime: title.runtime, seasons: title.seasons, directorOrCreator: title.directorOrCreator,
    leadCast: lead, clues, pointsPerSolve: 25, date,
  };
}

function dailyConnection(first: GameTitle, second: GameTitle, category: GameCategoryId, date: string) {
  const shared = new Map<number, GameTitle["cast"][number]>();
  const secondIds = new Set(second.cast.map((person) => person.id));
  first.cast.filter((person) => secondIds.has(person.id)).forEach((person) => shared.set(person.id, person));
  const answers = [...shared.values()].sort((a, b) => b.popularity - a.popularity).map((person) => person.name);
  if (!answers.length) return null;
  const lead = answers[0];
  return {
    category, kind: "connection", answer: lead, acceptedAnswers: answers,
    answerProfilePath: first.cast.find((person) => person.name === lead)?.profilePath || null,
    pair: [first, second].map((item) => ({ tmdbId: item.tmdbId, title: item.title, posterPath: item.posterPath, mediaType: item.mediaType })),
    clues: ["The performer appeared in both titles.", `${lead.split(" ").length === 1 ? "The name" : "Their name"} starts with ${lead[0]}.`],
    pointsPerSolve: 50, date,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const requestUrl = new URL(request.url);
  const developmentBootstrap = process.env.NODE_ENV === "development" && Boolean(requestUrl.searchParams.get("date"));
  if (!developmentBootstrap && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getFirebaseAdminDatabase();
  const today = utcGameDate();
  const nextDay = new Date(`${today}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const requestedDate = requestUrl.searchParams.get("date");
  const targetDate = developmentBootstrap && requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : utcGameDate(nextDay);
  const seedCategory = getSeedCategory(today);

  try {
    const currentCatalogSnapshot = await db.ref("games/catalogue").get();
    const catalog = (currentCatalogSnapshot.val() || {}) as Record<string, GameTitle>;
    // Seed a broad starter catalogue once; after that, keep the normal daily API budget small.
    const broadBootstrap = Object.keys(catalog).length < 30;
    const discoveryLimit = broadBootstrap ? 15 : 2;
    const page = broadBootstrap ? 1 : ((Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000) % 4) + 1);
    let discoveries = 0;
    let detailsCalls = 0;

    for (const mediaType of ["movie"] as const) {
      const discoverParams: Record<string, string | number> = {
        sort_by: "vote_average.desc",
        "vote_count.gte": 100,
        "primary_release_date.lte": targetDate,
        page,
      };
      if (!broadBootstrap) {
        discoverParams.with_original_language = seedCategory.language!;
        discoverParams.with_origin_country = seedCategory.country!;
      }
      const response = await readJson(`discover/${mediaType}`, discoverParams);
      discoveries += 1;
      const rows = (response.results || []) as Record<string, any>[];
      for (const row of rows.slice(0, discoveryLimit)) {
        const key = `${mediaType}_${Number(row.id)}`;
        if (catalog[key] && Date.now() - Number(catalog[key].updatedAt || 0) < 45 * 86_400_000) continue;
        try {
          const detail = await readJson(`${mediaType}/${Number(row.id)}`, {
            append_to_response: mediaType === "movie" ? "credits,alternative_titles" : "credits,alternative_titles",
          });
          const title = mapDetails(mediaType, detail);
          catalog[key] = title;
          detailsCalls += 1;
        } catch {
          const fallback = movieFallback(mediaType, row, broadBootstrap ? "" : seedCategory.country!);
          if (fallback.title) catalog[key] = fallback;
        }
      }
    }
    await db.ref("games/catalogue").set(catalog);

    const allTitles = Object.values(catalog).filter((title) => title && title.title && title.tmdbId);
    const dailyRef = db.ref(`games/daily/${targetDate}`);
    const existingDaily = await dailyRef.get();
    const existingGames = (existingDaily.val() || {}) as Record<string, Record<string, unknown>>;
    const usedMovieIds = new Set<number>();
    for (const row of Object.values(existingGames)) {
      const reveal = row?.reveal && typeof row.reveal === "object" ? row.reveal as Record<string, unknown> : null;
      if (reveal?.answerMediaType === "movie" && typeof reveal.answerTmdbId === "number") usedMovieIds.add(reveal.answerTmdbId);
      const connection = row?.connection && typeof row.connection === "object" ? row.connection as Record<string, unknown> : null;
      if (Array.isArray(connection?.pair)) for (const item of connection.pair) {
        if (!item || typeof item !== "object") continue;
        const pairItem = item as Record<string, unknown>;
        if (pairItem.mediaType !== "movie") continue;
        if (typeof pairItem.tmdbId === "number") usedMovieIds.add(pairItem.tmdbId);
        else if (typeof pairItem.title === "string") {
          const match = allTitles.find((title) => normalizeGameAnswer(title.title) === normalizeGameAnswer(pairItem.title as string));
          if (match) usedMovieIds.add(match.tmdbId);
        }
      }
    }
    const generated: Record<string, Record<string, unknown>> = {};
    for (const category of GAME_CATEGORIES) {
      const existing = existingGames[category.id] || {};
      const existingReveal = existing.reveal && typeof existing.reveal === "object" ? existing.reveal as Record<string, unknown> : null;
      const existingConnection = existing.connection && typeof existing.connection === "object" ? existing.connection as Record<string, unknown> : null;
      const hasMovieReveal = existingReveal?.answerMediaType === "movie";
      const hasMovieConnection = Array.isArray(existingConnection?.pair) && existingConnection.pair.length === 2 && existingConnection.pair.every((item) => item && typeof item === "object" && (item as Record<string, unknown>).mediaType === "movie");
      if (hasMovieReveal && hasMovieConnection) continue;
      const pool = allTitles.filter((title) => title.mediaType === "movie" && classifyGameTitle(title).includes(category.id) && title.voteCount >= 50 && title.releaseDate && title.releaseDate <= targetDate && !usedMovieIds.has(title.tmdbId));
      if (!hasMovieReveal && pool.length >= 1) {
        const gems = pool.filter((title) => (title.voteAverage || 0) >= 6.8 && title.voteCount <= 30_000);
        const candidates = (gems.length >= 3 ? gems : pool).slice().sort((a, b) =>
          (b.voteAverage || 0) - (a.voteAverage || 0) || a.voteCount - b.voteCount || a.popularity - b.popularity
        );
        const offset = [...category.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
        const day = Math.floor(Date.parse(`${targetDate}T00:00:00Z`) / 86_400_000);
        const selected = candidates[(day + offset) % candidates.length];
        generated[category.id] = { reveal: dailyReveal(selected, category.id, targetDate) };
        usedMovieIds.add(selected.tmdbId);
      }
      const connectionPool = pool.filter((title) => title.cast.length >= 2 && !usedMovieIds.has(title.tmdbId));
      let connection: ReturnType<typeof dailyConnection> = null;
      for (let left = 0; left < connectionPool.length && !connection; left += 1) {
        for (let right = left + 1; right < connectionPool.length && !connection; right += 1) {
          if (connectionPool[left].key === connectionPool[right].key) continue;
          connection = dailyConnection(connectionPool[left], connectionPool[right], category.id, targetDate);
        }
      }
      if (connection) {
        generated[category.id] = { ...(generated[category.id] || {}), connection };
        const pair = connection.pair as Array<{ tmdbId: number }>;
        pair.forEach((item) => usedMovieIds.add(item.tmdbId));
      }
    }
    // Publish once per UTC date so retries cannot change a puzzle mid-day.
    const mergedGames: Record<string, Record<string, unknown>> = { ...generated };
    for (const [category, existing] of Object.entries(existingGames)) {
      const oldReveal = existing.reveal && typeof existing.reveal === "object" ? existing.reveal as Record<string, unknown> : null;
      const oldConnection = existing.connection && typeof existing.connection === "object" ? existing.connection as Record<string, unknown> : null;
      const keepReveal = oldReveal?.answerMediaType === "movie";
      const keepConnection = Array.isArray(oldConnection?.pair) && oldConnection.pair.every((item) => item && typeof item === "object" && (item as Record<string, unknown>).mediaType === "movie");
      mergedGames[category] = { ...(mergedGames[category] || {}), ...(keepReveal ? { reveal: oldReveal } : {}), ...(keepConnection ? { connection: oldConnection } : {}) };
    }
    await dailyRef.set(mergedGames);
    await db.ref("games/meta").update({ catalogueUpdatedAt: Date.now(), puzzlesGeneratedFor: targetDate, seedCategory: seedCategory.id });
    return NextResponse.json({ ok: true, targetDate, seedCategory: seedCategory.id, catalogueSize: allTitles.length, discoveries, detailsCalls, categoriesReady: Object.keys(generated).length });
  } catch (error) {
    console.error("Games catalogue job failed:", error);
    return NextResponse.json({ error: "Games data refresh failed." }, { status: 503 });
  }
}
