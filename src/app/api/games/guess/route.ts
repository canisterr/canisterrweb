import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { GAME_CATEGORIES, matchesGameAnswer, utcGameDate } from "@/lib/games/types";
import { recordGameStreak } from "@/lib/games/streak";

export const dynamic = "force-dynamic";

type Puzzle = {
  kind?: "reveal" | "connection";
  acceptedAnswers?: string[];
  answer?: string;
  answerTmdbId?: number;
  answerMediaType?: "movie" | "tv";
  answerPosterPath?: string | null;
  posterPath?: string | null;
  answerProfilePath?: string | null;
  clues?: string[];
  attemptsAllowed?: number;
  pointsPerSolve?: number;
};
type Session = { attempts?: number; complete?: boolean; won?: boolean; score?: number; answers?: string[]; completedAt?: number | null };

function safeKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,64}$/.test(value);
}

async function getViewerId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    return (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { category?: unknown; kind?: unknown; guess?: unknown; sessionId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { category, kind } = body;
  if (typeof category !== "string" || !GAME_CATEGORIES.some((item) => item.id === category) || typeof kind !== "string" || !["reveal", "connection"].includes(kind) || typeof body.guess !== "string" || body.guess.length > 100 || !safeKey(body.sessionId)) {
    return NextResponse.json({ error: "Invalid guess." }, { status: 400 });
  }

  const date = utcGameDate();
  const db = getFirebaseAdminDatabase();
  const puzzleRef = db.ref(`games/daily/${date}/${category}/${kind}`);
  try {
    const puzzleSnapshot = await puzzleRef.get();
    if (!puzzleSnapshot.exists()) return NextResponse.json({ error: "This challenge is not available yet." }, { status: 404 });
    const puzzle = puzzleSnapshot.val() as Puzzle;
    const accepted = Array.isArray(puzzle.acceptedAnswers) ? puzzle.acceptedAnswers : [];
    if (!accepted.length || typeof puzzle.answer !== "string") return NextResponse.json({ error: "This challenge is not ready." }, { status: 503 });

    const viewerId = await getViewerId(request);
    const ownerKey = viewerId ? `users/${viewerId}` : `guests/${body.sessionId}`;
    const sessionRef = db.ref(`games/sessions/${ownerKey}/${date}/${category}/${kind}`);
    const guess = body.guess.trim();
    if (!guess) return NextResponse.json({ error: "Enter a guess." }, { status: 400 });
    const result = await sessionRef.transaction((current: Session | null) => {
      const session = current || { attempts: 0, complete: false, won: false, score: 0, answers: [] };
      const maxAttempts = kind === "reveal" ? 6 : 3;
      if (session.complete || (session.attempts || 0) >= maxAttempts) return;
      const answers = Array.isArray(session.answers) ? session.answers : [];
      if (guess !== "__skip__" && answers.some((entry) => matchesGameAnswer(entry, [guess]))) return;
      const attempts = (session.attempts || 0) + 1;
      const won = matchesGameAnswer(guess, accepted);
      const complete = won || attempts >= maxAttempts;
      const score = won ? Math.max(100, (maxAttempts - attempts + 1) * (puzzle.pointsPerSolve || 100)) : 0;
      return { attempts, complete, won, score, answers: guess === "__skip__" ? answers : [...answers, guess], completedAt: complete ? Date.now() : null };
    });

    if (!result.committed) {
      const previous = result.snapshot.val() as Session | null;
      return NextResponse.json({
        error: previous?.complete ? "You already finished this challenge." : "You already tried that guess.",
        attempts: previous?.attempts || 0,
        complete: Boolean(previous?.complete),
      }, { status: 409 });
    }

    const session = result.snapshot.val() as Session;
    let streak: number | undefined;
    if (session.complete) {
      streak = await recordGameStreak(db, ownerKey, kind as "reveal" | "connection", date).catch((error) => {
        console.error("Could not update game streak:", error);
        return undefined;
      });
    }
    const clues = Array.isArray(puzzle.clues) ? puzzle.clues : [];
    const attempts = session.attempts || 0;
    return NextResponse.json({
      attempts,
      complete: Boolean(session.complete),
      won: Boolean(session.won),
      score: session.score || 0,
      nextClue: !session.complete ? clues[attempts] || null : null,
      cluePosterPath: !session.complete && kind === "reveal" && attempts >= 5 ? puzzle.answerPosterPath || puzzle.posterPath || null : null,
      answer: session.complete ? puzzle.answer : null,
      answerTmdbId: session.complete ? puzzle.answerTmdbId || null : null,
      answerMediaType: session.complete ? puzzle.answerMediaType || null : null,
      answerPosterPath: session.complete ? puzzle.answerPosterPath || null : null,
      answerProfilePath: session.complete ? puzzle.answerProfilePath || null : null,
      streak,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save this attempt. Try again." }, { status: 503 });
  }
}
