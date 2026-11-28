import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getAdminIdentity } from "@/lib/admin-auth";
import { fetchTmdb } from "@/lib/tmdb-transport";
import { buildRevealClues, classifyGameTitle, GAME_CATEGORIES, hasDocumentaryGenre, isDocumentaryGameTitle, normalizeGameAnswer, utcGameDate, type GameCategoryId, type GameTitle } from "@/lib/games/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DailyPuzzle = Record<string, unknown>;

function isDocumentaryPuzzle(puzzle: DailyPuzzle | null | undefined, documentaryIds: Set<number>, documentaryNames: Set<string>): boolean {
  if (!puzzle) return false;
  if (hasDocumentaryGenre(puzzle.genres)) return true;
  if (typeof puzzle.answerTmdbId === "number" && documentaryIds.has(puzzle.answerTmdbId)) return true;
  return Array.isArray(puzzle.pair) && puzzle.pair.some((item) => {
    if (!item || typeof item !== "object") return false;
    const movie = item as Record<string, unknown>;
    return (typeof movie.tmdbId === "number" && documentaryIds.has(movie.tmdbId))
      || (typeof movie.title === "string" && documentaryNames.has(normalizeGameAnswer(movie.title)));
  });
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function asText(value: unknown): string { return typeof value === "string" ? value : ""; }
function asNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

async function getMovie(id: number): Promise<GameTitle> {
  const response = await fetchTmdb(`movie/${id}`, { append_to_response: "credits,alternative_titles" });
  if (!response.ok) throw new Error("Could not load that movie from TMDB.");
  const raw = await response.json() as Record<string, unknown>;
  const credits = raw.credits && typeof raw.credits === "object" ? raw.credits as Record<string, unknown> : {};
  const cast = Array.isArray(credits.cast) ? credits.cast as Array<Record<string, unknown>> : [];
  const crew = Array.isArray(credits.crew) ? credits.crew as Array<Record<string, unknown>> : [];
  const alt = raw.alternative_titles && typeof raw.alternative_titles === "object" ? raw.alternative_titles as Record<string, unknown> : {};
  const altTitles = Array.isArray(alt.titles) ? alt.titles as Array<Record<string, unknown>> : [];
  const name = asText(raw.title);
  if (!name) throw new Error("That movie could not be found.");
  const genres = (Array.isArray(raw.genres) ? raw.genres as Array<Record<string, unknown>> : []).map((genre) => asText(genre.name)).filter(Boolean);
  const director = crew.find((person) => person.job === "Director");
  const productionCompanies = (Array.isArray(raw.production_companies) ? raw.production_companies as Array<Record<string, unknown>> : []).map((company) => asText(company.name)).filter(Boolean);
  const productionCountries = (Array.isArray(raw.production_countries) ? raw.production_countries as Array<Record<string, unknown>> : []).map((country) => asText(country.iso_3166_1)).filter(Boolean);
  return {
    key: `movie_${id}`, tmdbId: id, mediaType: "movie", title: name,
    originalTitle: asText(raw.original_title) || name,
    aliases: [...new Set(altTitles.map((item) => asText(item.title)).filter(Boolean))],
    originalLanguage: asText(raw.original_language), productionCountries,
    releaseDate: asText(raw.release_date), genres, productionCompanies,
    runtime: typeof raw.runtime === "number" ? raw.runtime : null, seasons: null,
    cast: cast.slice(0, 30).flatMap((person) => {
      const personName = asText(person.name); const personId = asNumber(person.id);
      return personName && personId > 0 ? [{ id: personId, name: personName, popularity: asNumber(person.popularity), profilePath: asText(person.profile_path) || null }] : [];
    }),
    directorOrCreator: asText(director?.name) || null,
    posterPath: asText(raw.poster_path) || null, backdropPath: asText(raw.backdrop_path) || null,
    popularity: asNumber(raw.popularity), voteCount: asNumber(raw.vote_count), voteAverage: asNumber(raw.vote_average), updatedAt: Date.now(),
  };
}

async function resolveMovie(id: number): Promise<GameTitle> {
  const db = getFirebaseAdminDatabase();
  const snapshot = await db.ref(`games/catalogue/movie_${id}`).get();
  const saved = snapshot.val() as GameTitle | null;
  if (saved?.title && saved.cast?.length && saved.genres?.length && !isDocumentaryGameTitle(saved)) return saved;
  const movie = await getMovie(id);
  if (isDocumentaryGameTitle(movie)) throw new Error("Documentaries can’t be scheduled in games.");
  await db.ref(`games/catalogue/movie_${id}`).set(movie);
  return movie;
}

function sharedCast(left: GameTitle, right: GameTitle) {
  const other = new Map(right.cast.map((person) => [person.id, person]));
  return left.cast.filter((person) => other.has(person.id)).map((person) => ({ ...person, popularity: Math.max(person.popularity, other.get(person.id)?.popularity || 0) })).sort((a, b) => b.popularity - a.popularity);
}

function makePuzzle(date: string, category: GameCategoryId, kind: "reveal" | "connection", movies: GameTitle[]): DailyPuzzle {
  if (kind === "reveal") {
    const movie = movies[0];
    const lead = movie.cast[0]?.name || null;
    const clues = buildRevealClues(movie);
    return {
      category, kind, answer: movie.title,
      acceptedAnswers: [...new Set([movie.title, movie.originalTitle, ...movie.aliases].filter(Boolean))],
      answerTmdbId: movie.tmdbId, answerMediaType: "movie", answerPosterPath: movie.posterPath,
      posterPath: movie.posterPath, backdropPath: movie.backdropPath, releaseDate: movie.releaseDate,
      genres: movie.genres, runtime: movie.runtime, seasons: null, directorOrCreator: movie.directorOrCreator,
      leadCast: lead, clues, firstClue: clues[0], clueVersion: 2, pointsPerSolve: 25, date, adminSet: true,
    };
  }
  const actors = sharedCast(movies[0], movies[1]);
  if (!actors.length) throw new Error("These movies do not share a credited actor. Choose a connected pair.");
  const actor = actors[0];
  return {
    category, kind, answer: actor.name, acceptedAnswers: [...new Set(actors.map((person) => person.name))],
    answerProfilePath: actor.profilePath,
    pair: movies.map((movie) => ({ tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, mediaType: "movie" })),
    clues: ["One actor appears in both films.", `The shared actor’s name starts with ${actor.name[0]}.`],
    firstClue: "One actor appears in both films.", pointsPerSolve: 50, date, adminSet: true,
  };
}

function occupiedMovieIds(daily: Record<string, unknown>, exceptCategory: string, exceptKind: string): Set<number> {
  const ids = new Set<number>();
  for (const [category, rawRow] of Object.entries(daily)) {
    if (!rawRow || typeof rawRow !== "object") continue;
    const row = rawRow as Record<string, unknown>;
    for (const [kind, rawPuzzle] of Object.entries(row)) {
      if (category === exceptCategory && kind === exceptKind) continue;
      if (!rawPuzzle || typeof rawPuzzle !== "object") continue;
      const puzzle = rawPuzzle as Record<string, unknown>;
      if (puzzle.answerMediaType === "movie" && Number.isSafeInteger(puzzle.answerTmdbId)) ids.add(Number(puzzle.answerTmdbId));
      if (Array.isArray(puzzle.pair)) for (const rawMovie of puzzle.pair) {
        if (rawMovie && typeof rawMovie === "object") {
          const movie = rawMovie as Record<string, unknown>;
          if (movie.mediaType === "movie" && Number.isSafeInteger(movie.tmdbId)) ids.add(Number(movie.tmdbId));
        }
      }
    }
  }
  return ids;
}

export async function GET(request: NextRequest) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const date = request.nextUrl.searchParams.get("date") || utcGameDate();
  const category = request.nextUrl.searchParams.get("category") || "english";
  if (!validDate(date) || !GAME_CATEGORIES.some((item) => item.id === category)) return NextResponse.json({ error: "Choose a valid date and cinema." }, { status: 400 });
  try {
    const db = getFirebaseAdminDatabase();
    const [rowSnapshot, catalogueSnapshot] = await Promise.all([
      db.ref(`games/daily/${date}/${category}`).get(),
      db.ref("games/catalogue").get(),
    ]);
    const row = rowSnapshot.val() as Record<string, DailyPuzzle> | null;
    const titles = Object.values((catalogueSnapshot.val() || {}) as Record<string, GameTitle>);
    const documentaryIds = new Set(titles.filter(isDocumentaryGameTitle).map((movie) => movie.tmdbId));
    const documentaryNames = new Set(titles.filter(isDocumentaryGameTitle).map((movie) => normalizeGameAnswer(movie.title)));
    return NextResponse.json({ date, category, games: {
      reveal: isDocumentaryPuzzle(row?.reveal, documentaryIds, documentaryNames) ? null : row?.reveal || null,
      connection: isDocumentaryPuzzle(row?.connection, documentaryIds, documentaryNames) ? null : row?.connection || null,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the scheduled games." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const date = typeof body.date === "string" ? body.date : "";
  const category = typeof body.category === "string" ? body.category : "";
  const kind = body.kind === "connection" ? "connection" : body.kind === "reveal" ? "reveal" : null;
  const ids = Array.isArray(body.movieIds) ? body.movieIds : [];
  const expected = kind === "connection" ? 2 : 1;
  if (!validDate(date) || !GAME_CATEGORIES.some((item) => item.id === category) || !kind || ids.length !== expected || ids.some((id) => !Number.isSafeInteger(id) || Number(id) < 1) || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: kind === "connection" ? "Choose two different movies for Connection." : "Choose one movie for Reveal." }, { status: 400 });
  }
  try {
    const movies = await Promise.all((ids as number[]).map(resolveMovie));
    if (movies.some(isDocumentaryGameTitle)) return NextResponse.json({ error: "Documentaries can’t be scheduled in games." }, { status: 400 });
    const categoryId = category as GameCategoryId;
    if (movies.some((movie) => !classifyGameTitle(movie).includes(categoryId))) {
      return NextResponse.json({ error: "One or more movies do not belong to this cinema category." }, { status: 400 });
    }
    let puzzle: DailyPuzzle;
    try { puzzle = makePuzzle(date, categoryId, kind, movies); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build this game." }, { status: 400 }); }
    if (body.action === "preview") {
      const actors = kind === "connection" ? sharedCast(movies[0], movies[1]).map((person) => person.name) : [];
      return NextResponse.json({ movies: movies.map((movie) => ({ id: movie.tmdbId, title: movie.title, posterPath: movie.posterPath, year: movie.releaseDate.slice(0, 4) })), actors, clues: puzzle.clues }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action !== "schedule") return NextResponse.json({ error: "Choose preview or schedule." }, { status: 400 });
    const db = getFirebaseAdminDatabase();
    const dailyRef = db.ref(`games/daily/${date}`);
    const result = await dailyRef.transaction((current: Record<string, unknown> | null) => {
      const daily = current || {};
      const used = occupiedMovieIds(daily, categoryId, kind);
      if (movies.some((movie) => used.has(movie.tmdbId))) return;
      const row = daily[categoryId] && typeof daily[categoryId] === "object" ? daily[categoryId] as Record<string, unknown> : {};
      return { ...daily, [categoryId]: { ...row, [kind]: puzzle } };
    });
    if (!result.committed) return NextResponse.json({ error: "A selected movie is already used by another game on this date. Pick another movie." }, { status: 409 });
    return NextResponse.json({ ok: true, date, category, kind, movies: movies.map((movie) => movie.title) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Admin daily game schedule failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not schedule this game." }, { status: 503 });
  }
}
