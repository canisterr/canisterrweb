import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { expandGameCategoryCatalogue } from "@/lib/games/category-catalogue";
import { classifyGameTitle, GAME_CATEGORIES, normalizeGameAnswer, utcGameDate, type GameCategoryId, type GameTitle, type PublicDailyGame } from "@/lib/games/types";
import { activeGameStreak, type GameStreak, type GameStreakKind } from "@/lib/games/streak";

export const dynamic = "force-dynamic";
const bootstrapJobs = new Map<string, Promise<void>>();

function storedMovieIds(daily: Record<string, unknown> | null, titles: GameTitle[], skipCategory?: string, skipKind?: string): Set<number> {
  const ids = new Set<number>();
  for (const [category, rowValue] of Object.entries(daily || {})) {
    const row = rowValue && typeof rowValue === "object" ? rowValue as Record<string, unknown> : {};
    for (const [kind, value] of Object.entries(row)) {
      if (category === skipCategory && (skipKind === undefined || kind === skipKind)) continue;
      if (!value || typeof value !== "object") continue;
      const game = value as Record<string, unknown>;
      if (kind === "reveal" && game.answerMediaType === "movie" && typeof game.answerTmdbId === "number") ids.add(game.answerTmdbId);
      if (kind === "connection" && Array.isArray(game.pair)) {
        for (const item of game.pair) {
          if (!item || typeof item !== "object") continue;
          const title = item as Record<string, unknown>;
          if (title.mediaType !== "movie") continue;
          if (typeof title.tmdbId === "number") ids.add(title.tmdbId);
          else if (typeof title.title === "string") {
            const match = titles.find((entry) => normalizeGameAnswer(entry.title) === normalizeGameAnswer(title.title as string));
            if (match) ids.add(match.tmdbId);
          }
        }
      }
    }
  }
  return ids;
}

function createMissingDailyGames(titles: GameTitle[], category: GameCategoryId, date: string, usedIds: Set<number>, needReveal: boolean, needConnection: boolean) {
  const pool = titles.filter((title) => title?.mediaType === "movie" && title.title && classifyGameTitle(title).includes(category) && Number(title.voteCount) >= 50 && title.releaseDate && title.releaseDate <= date);
  const available = pool.filter((title) => !usedIds.has(title.tmdbId));
  let reveal: Record<string, unknown> | null = null;
  const chosenIds = new Set(usedIds);
  if (needReveal && available.length) {
    const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    const gems = available.filter((title) => (title.voteAverage || 0) >= 6.8 && title.voteCount <= 30_000);
    const sorted = (gems.length >= 3 ? gems : available).slice().sort((a, b) =>
      (b.voteAverage || 0) - (a.voteAverage || 0) || a.voteCount - b.voteCount || a.popularity - b.popularity
    );
    const categoryOffset = [...category].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const title = sorted[((day + categoryOffset) % sorted.length + sorted.length) % sorted.length];
    chosenIds.add(title.tmdbId);
    const year = title.releaseDate.slice(0, 4);
    const lead = title.cast?.[0]?.name || null;
    reveal = {
      category, kind: "reveal", answer: title.title,
      acceptedAnswers: [...new Set([title.title, title.originalTitle, ...title.aliases].filter(Boolean))],
      answerTmdbId: title.tmdbId, answerMediaType: "movie", answerPosterPath: title.posterPath,
      posterPath: title.posterPath, backdropPath: title.backdropPath, releaseDate: title.releaseDate,
      genres: title.genres, runtime: title.runtime, seasons: null, directorOrCreator: title.directorOrCreator,
      leadCast: lead,
      clues: [title.genres.length ? `Its genres include ${title.genres.slice(0, 2).join(" and ").toLowerCase()}.` : "It is a feature film.", title.runtime ? `It runs for about ${Math.round(title.runtime / 10) * 10} minutes.` : "It was released before today.", year ? `Released in ${year}.` : "Think about the decade.", title.directorOrCreator ? `Directed by ${title.directorOrCreator}.` : "Think about who made it.", lead ? `Featuring ${lead}.` : "A lead performer appears in another film.", "Poster clue unlocked."],
      pointsPerSolve: 25, date,
    };
  }
  let connection: Record<string, unknown> | null = null;
  if (needConnection) {
    const sorted = pool.filter((title) => !chosenIds.has(title.tmdbId)).sort((a, b) =>
      (a.voteAverage || 0) - (b.voteAverage || 0) || b.voteCount - a.voteCount || b.popularity - a.popularity
    );
    for (let left = 0; left < sorted.length && !connection; left += 1) {
      for (let right = left + 1; right < sorted.length && !connection; right += 1) {
        const leftCast = Array.isArray(sorted[left].cast) ? sorted[left].cast : [];
        const secondCast = new Set((Array.isArray(sorted[right].cast) ? sorted[right].cast : []).map((person) => person.id));
        const shared = leftCast.filter((person) => secondCast.has(person.id)).sort((a, b) => b.popularity - a.popularity);
        if (!shared.length) continue;
        connection = {
          category, kind: "connection", answer: shared[0].name,
          acceptedAnswers: [...new Set(shared.map((person) => person.name))],
          answerProfilePath: shared[0].profilePath,
          pair: [sorted[left], sorted[right]].map((item) => ({ tmdbId: item.tmdbId, title: item.title, posterPath: item.posterPath, mediaType: "movie" })),
          clues: ["The actor appeared in both movies.", `Their name starts with ${shared[0].name[0]}.`],
          pointsPerSolve: 50, date,
        };
      }
    }
  }
  return { reveal, connection };
}

async function ensureCategoryPuzzles(db: ReturnType<typeof getFirebaseAdminDatabase>, date: string, category: GameCategoryId, allDaily: Record<string, unknown> | null, current: Record<string, unknown> | null) {
  const currentReveal = current?.reveal && typeof current.reveal === "object" ? current.reveal as Record<string, unknown> : null;
  const currentConnection = current?.connection && typeof current.connection === "object" ? current.connection as Record<string, unknown> : null;
  const externalIds = storedMovieIds(allDaily, [], category);
  const currentRevealId = currentReveal?.answerMediaType === "movie" && typeof currentReveal.answerTmdbId === "number" ? currentReveal.answerTmdbId : null;
  const adminReveal = currentReveal?.adminSet === true;
  const adminConnection = currentConnection?.adminSet === true;
  const currentConnectionIds = (Array.isArray(currentConnection?.pair) ? currentConnection.pair : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const pair = item as Record<string, unknown>;
    return pair.mediaType === "movie" && typeof pair.tmdbId === "number" ? [pair.tmdbId] : [];
  });
  const replaceReveal = !adminReveal && (currentReveal?.answerMediaType === "tv" || Boolean(currentRevealId && (externalIds.has(currentRevealId) || currentConnectionIds.includes(currentRevealId))));
  const replaceConnection = !adminConnection && ((Array.isArray(currentConnection?.pair) && currentConnection.pair.some((item) => item && typeof item === "object" && (item as Record<string, unknown>).mediaType === "tv")) || currentConnectionIds.some((id) => externalIds.has(id) || id === currentRevealId));
  if (current?.reveal && current?.connection && !replaceReveal && !replaceConnection) return current;
  const catalogue = await db.ref("games/catalogue").get();
  let titles = Object.values((catalogue.val() || {}) as Record<string, GameTitle>);
  const needReveal = !current?.reveal || replaceReveal;
  const needConnection = !current?.connection || replaceConnection;
  const usedIds = storedMovieIds(allDaily, titles, category);
  if (currentRevealId && !replaceReveal) usedIds.add(currentRevealId);
  if (!replaceConnection) for (const id of currentConnectionIds) usedIds.add(id);
  const create = () => createMissingDailyGames(titles, category, date, usedIds, needReveal, needConnection);
  let created = create();
  if ((needReveal && !created.reveal) || (needConnection && !created.connection)) {
    titles = await expandGameCategoryCatalogue(category, titles);
    created = create();
  }
  if ((needReveal && !created.reveal) || (needConnection && !created.connection)) return current;
  const next = { ...(current || {}), ...(needReveal ? { reveal: created.reveal } : {}), ...(needConnection ? { connection: created.connection } : {}) };
  await db.ref(`games/daily/${date}/${category}`).transaction((stored: Record<string, unknown> | null) => {
    const reveal = stored?.reveal && typeof stored.reveal === "object" ? stored.reveal as Record<string, unknown> : null;
    const connection = stored?.connection && typeof stored.connection === "object" ? stored.connection as Record<string, unknown> : null;
    const hasTvConnection = Array.isArray(connection?.pair) && connection.pair.some((item) => item && typeof item === "object" && (item as Record<string, unknown>).mediaType === "tv");
    return { ...(stored || {}), ...(!reveal || reveal.answerMediaType === "tv" || replaceReveal ? { reveal: created.reveal } : {}), ...(!connection || hasTvConnection || replaceConnection ? { connection: created.connection } : {}) };
  });
  return next;
}

async function bootstrapLocalGames(date: string, requestUrl: string) {
  if (process.env.NODE_ENV !== "development") return;
  let job = bootstrapJobs.get(date);
  if (!job) {
    job = (async () => {
      const { GET: seedGames } = await import("@/app/api/cron/games/route");
      const seedUrl = new URL("/api/cron/games", requestUrl);
      seedUrl.searchParams.set("date", date);
      const response = await seedGames(new Request(seedUrl));
      if (!response.ok) throw new Error("Could not prepare today’s games.");
    })();
    bootstrapJobs.set(date, job);
  }
  try { await job; } finally { bootstrapJobs.delete(date); }
}

function toPublicPuzzle(id: string, raw: Record<string, unknown>): PublicDailyGame | null {
  const kind = raw.kind === "connection" ? "connection" : raw.kind === "reveal" ? "reveal" : null;
  if (!kind || typeof raw.category !== "string") return null;
  if (raw.answerMediaType === "tv") return null;
  if (kind === "connection" && Array.isArray(raw.pair) && raw.pair.some((item) => item && typeof item === "object" && (item as Record<string, unknown>).mediaType === "tv")) return null;
  const clues = Array.isArray(raw.clues) ? raw.clues : [];
  return {
    id,
    category: raw.category as GameCategoryId,
    kind,
    title: kind === "reveal" ? "The Reveal" : "The Connection",
    // Keep answer clues server-side until the player earns them.
    posterPath: kind === "connection" && typeof raw.posterPath === "string" ? raw.posterPath : null,
    backdropPath: null,
    releaseDate: "",
    genres: [],
    runtime: null,
    seasons: null,
    directorOrCreator: null,
    leadCast: null,
    pair: Array.isArray(raw.pair) ? raw.pair as PublicDailyGame["pair"] : undefined,
    firstClue: typeof clues[0] === "string" ? clues[0] : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const requestedCategory = request.nextUrl.searchParams.get("category");
    if (requestedCategory && !GAME_CATEGORIES.some((item) => item.id === requestedCategory)) {
      return NextResponse.json({ error: "Unknown cinema language." }, { status: 400 });
    }
    const date = utcGameDate();
    const db = getFirebaseAdminDatabase();
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    let uid: string | null = null;
    if (token) {
      try { uid = (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid; } catch { uid = null; }
    }
    const guestId = request.nextUrl.searchParams.get("sessionId");
    const owner = uid ? `users/${uid}` : guestId && /^[a-zA-Z0-9_-]{12,64}$/.test(guestId) ? `guests/${guestId}` : null;
    let [snapshot, sessionsSnapshot, streaksSnapshot] = await Promise.all([
      db.ref(`games/daily/${date}`).get(),
      owner ? db.ref(`games/sessions/${owner}/${date}`).get() : Promise.resolve(null),
      owner ? db.ref(`games/streaks/${owner}`).get() : Promise.resolve(null),
    ]);
    let needsLocalBootstrap = !snapshot.exists();
    if (process.env.NODE_ENV === "development" && !needsLocalBootstrap) {
      const catalogueSnapshot = await db.ref("games/catalogue").get();
      needsLocalBootstrap = Object.keys(catalogueSnapshot.val() || {}).length < 30;
    }
    if (needsLocalBootstrap && process.env.NODE_ENV === "development") {
      try {
        await bootstrapLocalGames(date, request.url);
        [snapshot, sessionsSnapshot, streaksSnapshot] = await Promise.all([
          db.ref(`games/daily/${date}`).get(),
          owner ? db.ref(`games/sessions/${owner}/${date}`).get() : Promise.resolve(null),
          owner ? db.ref(`games/streaks/${owner}`).get() : Promise.resolve(null),
        ]);
      } catch {
        return NextResponse.json({ error: "Today’s games could not be prepared. Check the TMDB and Firebase server settings." }, { status: 503 });
      }
    }
    if (requestedCategory) {
      const current = (snapshot.child(requestedCategory).val() || null) as Record<string, unknown> | null;
      try {
        await ensureCategoryPuzzles(db, date, requestedCategory as GameCategoryId, snapshot.val() as Record<string, unknown> | null, current);
        snapshot = await db.ref(`games/daily/${date}`).get();
      } catch {
        // Existing daily puzzles remain playable when TMDB cannot refresh this category.
      }
    }
    const stored = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const games: Partial<Record<GameCategoryId, { reveal: PublicDailyGame | null; connection: PublicDailyGame | null }>> = {};
    for (const category of GAME_CATEGORIES) {
      const row = stored?.[category.id] as Record<string, Record<string, unknown>> | undefined;
      games[category.id] = {
        reveal: row?.reveal ? toPublicPuzzle(`${date}:${category.id}:reveal`, row.reveal) : null,
        connection: row?.connection ? toPublicPuzzle(`${date}:${category.id}:connection`, row.connection) : null,
      };
    }
    const sessions = (sessionsSnapshot?.val() || {}) as Record<string, Record<string, Record<string, unknown>>>;
    const savedStreaks = (streaksSnapshot?.val() || {}) as Partial<Record<GameStreakKind, GameStreak>>;
    const streaks = {
      reveal: activeGameStreak(savedStreaks.reveal, date),
      connection: activeGameStreak(savedStreaks.connection, date),
      grid: activeGameStreak(savedStreaks.grid, date),
    };
    const played = {
      grid: savedStreaks.grid?.lastPlayedDate === date,
    };
    for (const category of GAME_CATEGORIES) {
      for (const kind of ["reveal", "connection"] as const) {
        const session = sessions[category.id]?.[kind];
        const puzzle = (stored?.[category.id] as Record<string, Record<string, unknown>> | undefined)?.[kind];
        if (session?.complete && Number(session.attempts) > 0 && puzzle) {
          session.answer = puzzle.answer || null;
          session.answerTmdbId = puzzle.answerTmdbId || null;
          session.answerMediaType = puzzle.answerMediaType || null;
          session.answerPosterPath = puzzle.answerPosterPath || null;
          session.answerProfilePath = puzzle.answerProfilePath || null;
        }
      }
    }
    return NextResponse.json({ date, resetTimeZone: "UTC", games, sessions, streaks, played }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Games are temporarily unavailable." }, { status: 503 });
  }
}
