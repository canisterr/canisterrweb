import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { expandGameCategoryCatalogue } from "@/lib/games/category-catalogue";
import { classifyGameTitle, GAME_CATEGORIES, normalizeGameAnswer, utcGameDate, type GameCategoryId, type GameTitle } from "@/lib/games/types";
import { recordGameStreak } from "@/lib/games/streak";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getViewerId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try { return (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid; } catch { return null; }
}

type CellAnswer = { key: string; title: string; aliases: string[]; posterPath: string | null; tmdbId: number; mediaType: "movie" | "tv" };
type GridSecret = { id: string; category: GameCategoryId; difficulty: string; rows: string[]; rowProfiles?: Array<string | null>; columns: string[]; cells: CellAnswer[][]; uniqueAnswers: boolean; mode: "matrix" | "clue-cells"; cellClues?: Array<{ actor: string; actorProfilePath: string | null; genre: string }>; createdAt: number };

function choose<T>(values: T[], amount: number): T[][] {
  const out: T[][] = [];
  function visit(start: number, picked: T[]) {
    if (picked.length === amount) { out.push(picked); return; }
    for (let index = start; index < values.length; index += 1) visit(index + 1, [...picked, values[index]]);
  }
  visit(0, []);
  return out;
}

function solveDistinct(cells: CellAnswer[][]): CellAnswer[] | null {
  const failed = new Set<string>();
  function search(remaining: Array<{ index: number; options: CellAnswer[] }>, used: Set<string>): CellAnswer[] | null {
    if (!remaining.length) return [];
    const stateKey = `${remaining.map((cell) => cell.index).sort((a, b) => a - b).join(",")}|${[...used].sort().join(",")}`;
    if (failed.has(stateKey)) return null;
    let selectedIndex = -1;
    let selectedOptions: CellAnswer[] = [];
    for (let index = 0; index < remaining.length; index += 1) {
      const options = remaining[index].options.filter((answer) => !used.has(answer.key));
      if (!options.length) { failed.add(stateKey); return null; }
      if (selectedIndex < 0 || options.length < selectedOptions.length) {
        selectedIndex = index;
        selectedOptions = options;
      }
    }
    const [selected] = remaining.splice(selectedIndex, 1);
    for (const answer of selectedOptions) {
      const nextUsed = new Set(used);
      nextUsed.add(answer.key);
      const result = search(remaining, nextUsed);
      if (result) {
        remaining.splice(selectedIndex, 0, selected);
        return [answer, ...result];
      }
    }
    remaining.splice(selectedIndex, 0, selected);
    failed.add(stateKey);
    return null;
  }
  return search(cells.map((options, index) => ({ index, options })), new Set());
}

function toAnswer(title: GameTitle): CellAnswer {
  return { key: title.key, title: title.title, aliases: [title.title, title.originalTitle, ...title.aliases].filter(Boolean), posterPath: title.posterPath, tmdbId: title.tmdbId, mediaType: title.mediaType };
}

function createGrid(titles: GameTitle[], category: GameCategoryId, difficulty: "easy" | "medium" | "hard", usedIds: Set<number>): Omit<GridSecret, "id" | "createdAt" | "category" | "difficulty"> | null {
  const usable = titles.filter((title) =>
    title?.mediaType === "movie" &&
    !usedIds.has(title.tmdbId) &&
    Array.isArray(title?.cast) && title.cast.length > 0 &&
    Array.isArray(title?.genres) && title.genres.length > 0 &&
    !title.genres.some((genre) => genre.trim().toLowerCase() === "documentary") &&
    Array.isArray(title?.productionCountries) &&
    classifyGameTitle(title).includes(category) && Number(title.voteCount) >= 50 && Boolean(title.releaseDate) && title.releaseDate <= utcGameDate()
  );
  const genres = new Map<string, number>();
  const actors = new Map<string, { count: number; popularity: number; profilePath: string | null }>();
  for (const title of usable) {
    title.genres.forEach((genre) => genres.set(genre, (genres.get(genre) || 0) + 1));
    title.cast.forEach((person) => {
      const previous = actors.get(person.name) || { count: 0, popularity: 0, profilePath: person.profilePath };
      actors.set(person.name, { count: previous.count + 1, popularity: previous.popularity + person.popularity, profilePath: previous.profilePath || person.profilePath });
    });
  }
  const popularityDirection = difficulty === "hard" ? 1 : -1;
  const actorNames = [...actors.entries()].filter(([, value]) => value.count >= 2).sort((a, b) => popularityDirection * (a[1].popularity - b[1].popularity)).slice(0, 8).map(([name]) => name);
  const genreNames = [...genres.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
  for (const actorSet of choose(actorNames, 3)) {
    for (const genreSet of choose(genreNames, 3)) {
      const candidates = actorSet.flatMap((actor) => genreSet.map((genre) => usable
        .filter((title) => title.genres.includes(genre) && title.cast.some((person) => person.name === actor))
        .sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0) || a.voteCount - b.voteCount || a.popularity - b.popularity)
        .slice(0, 20)
        .map(toAnswer)));
      if (candidates.some((items) => items.length === 0)) continue;
      const uniqueAssignment = solveDistinct(candidates);
      if (uniqueAssignment) {
        return { rows: actorSet, rowProfiles: actorSet.map((name) => actors.get(name)?.profilePath || null), columns: genreSet, cells: candidates, uniqueAnswers: true, mode: "matrix" };
      }
    }
  }
  if (usable.length >= 9) {
    const selected = [...usable].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0) || a.voteCount - b.voteCount || a.popularity - b.popularity).slice(0, Math.min(30, usable.length));
    const shuffled = selected.sort(() => Math.random() - 0.5).slice(0, 9);
    return {
      rows: [], columns: [], cells: shuffled.map((title) => [toAnswer(title)]), uniqueAnswers: true,
      mode: "clue-cells",
      cellClues: shuffled.map((title) => ({ actor: title.cast[0].name, actorProfilePath: title.cast[0].profilePath || null, genre: title.genres[0] })),
    };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || "english";
  const difficulty = request.nextUrl.searchParams.get("difficulty") || "medium";
  if (!GAME_CATEGORIES.some((item) => item.id === category) || !["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "Invalid grid settings." }, { status: 400 });
  }
  try {
    const db = getFirebaseAdminDatabase();
    const [snapshot, dailySnapshot] = await Promise.all([
      db.ref("games/catalogue").get(),
      db.ref(`games/daily/${utcGameDate()}`).get(),
    ]);
    let titles = Object.values((snapshot.val() || {}) as Record<string, GameTitle>);
    const usedIds = new Set<number>();
    const daily = (dailySnapshot.val() || {}) as Record<string, Record<string, unknown>>;
    for (const row of Object.values(daily)) {
      const reveal = row?.reveal && typeof row.reveal === "object" ? row.reveal as Record<string, unknown> : null;
      if (reveal?.answerMediaType === "movie" && typeof reveal.answerTmdbId === "number") usedIds.add(reveal.answerTmdbId);
      const connection = row?.connection && typeof row.connection === "object" ? row.connection as Record<string, unknown> : null;
      if (Array.isArray(connection?.pair)) for (const item of connection.pair) {
        if (item && typeof item === "object") {
          const pair = item as Record<string, unknown>;
          if (pair.mediaType === "movie" && typeof pair.tmdbId === "number") usedIds.add(pair.tmdbId);
          else if (pair.mediaType === "movie" && typeof pair.title === "string") {
            const matchingTitle = titles.find((title) => normalizeGameAnswer(title.title) === normalizeGameAnswer(pair.title as string));
            if (matchingTitle) usedIds.add(matchingTitle.tmdbId);
          }
        }
      }
    }
    let grid = createGrid(titles, category as GameCategoryId, difficulty as "easy" | "medium" | "hard", usedIds);
    if (!grid) {
      titles = await expandGameCategoryCatalogue(category as GameCategoryId, titles);
      grid = createGrid(titles, category as GameCategoryId, difficulty as "easy" | "medium" | "hard", usedIds);
    }
    if (!grid) return NextResponse.json({ error: "A grid for this language is still being prepared. Please try again after the next catalogue refresh." }, { status: 503 });
    const id = randomUUID().replace(/-/g, "");
    const secret: GridSecret = { ...grid, id, category: category as GameCategoryId, difficulty, createdAt: Date.now() };
    await getFirebaseAdminDatabase().ref(`games/grids/${id}`).set(secret);
    return NextResponse.json({ id, category, difficulty, rows: grid.rows, rowProfiles: grid.rowProfiles, columns: grid.columns, uniqueAnswers: grid.uniqueAnswers, mode: grid.mode, cellClues: grid.cellClues, maxGuesses: 9 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not create games grid:", error);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "Could not start a grid. Try again in a moment." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: { gridId?: unknown; guesses?: unknown; sessionId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.gridId !== "string" || !/^[a-f0-9]{32}$/.test(body.gridId) || !Array.isArray(body.guesses) || body.guesses.length !== 9 || body.guesses.some((guess) => typeof guess !== "string" || guess.length > 100) || typeof body.sessionId !== "string" || !/^[a-zA-Z0-9_-]{12,64}$/.test(body.sessionId)) {
    return NextResponse.json({ error: "Fill all nine squares before checking." }, { status: 400 });
  }
  try {
    const db = getFirebaseAdminDatabase();
    const viewerId = await getViewerId(request);
    const ownerKey = viewerId ? `users/${viewerId}` : `guests/${body.sessionId}`;
    const snapshot = await db.ref(`games/grids/${body.gridId}`).get();
    if (!snapshot.exists()) return NextResponse.json({ error: "This grid expired. Start a new one." }, { status: 404 });
    const puzzle = snapshot.val() as GridSecret;
    if (Date.now() - puzzle.createdAt > 2 * 60 * 60 * 1000) return NextResponse.json({ error: "This grid expired. Start a new one." }, { status: 410 });
    const used = new Set<string>();
    const results = (body.guesses as string[]).map((guess, index) => {
      const match = puzzle.cells[index].find((answer) =>
        answer.aliases.some((alias) => normalizeGameAnswer(alias) === normalizeGameAnswer(guess)) &&
        (!puzzle.uniqueAnswers || !used.has(answer.key))
      );
      if (match && puzzle.uniqueAnswers) used.add(match.key);
      const answer = match || puzzle.cells[index][0];
      return { correct: Boolean(match), answer: { title: answer.title, posterPath: answer.posterPath, tmdbId: answer.tmdbId, mediaType: answer.mediaType } };
    });
    const streak = await recordGameStreak(db, ownerKey, "grid", utcGameDate()).catch((error) => {
      console.error("Could not update game streak:", error);
      return undefined;
    });
    return NextResponse.json({ results, score: results.filter((result) => result.correct).length, completed: true, streak }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not check games grid:", error);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "Could not check this grid." }, { status: 503 });
  }
}
