"use client";

import type { GameCategoryId, PublicDailyGame } from "./types";

export type SavedRun = {
  attempts: number;
  complete: boolean;
  won: boolean;
  score: number;
  answer?: string;
  clue?: string;
  answerTmdbId?: number;
  answerMediaType?: "movie" | "tv";
  answerPosterPath?: string | null;
  answerProfilePath?: string | null;
};

export type DailyPayload = {
  date: string;
  resetTimeZone: string;
  games: Record<string, { reveal: PublicDailyGame | null; connection: PublicDailyGame | null }>;
  sessions?: Record<string, Record<string, SavedRun>>;
  streaks: Record<"reveal" | "connection" | "grid", number>;
  played?: { grid: boolean };
};

const SESSION_KEY = "canisterr.games.guest.v1";
const DAILY_CACHE_MS = 30_000;
const dailyRequests = new Map<string, { promise: Promise<DailyPayload>; expiresAt: number }>();

export function getGuestId(): string {
  try {
    const previous = localStorage.getItem(SESSION_KEY);
    if (previous) return previous;
    const id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

export function loadDailyGames(identity: string, category: GameCategoryId, token?: string | null): Promise<DailyPayload> {
  const cacheKey = `${identity}:${category}`;
  const cached = dailyRequests.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetch(`/api/games/daily?category=${encodeURIComponent(category)}&sessionId=${encodeURIComponent(getGuestId())}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).then(async (response) => {
    if (!response.ok) throw new Error("Could not load today’s games.");
    return await response.json() as DailyPayload;
  }).catch((error) => {
    dailyRequests.delete(cacheKey);
    throw error;
  });

  dailyRequests.set(cacheKey, { promise, expiresAt: Date.now() + DAILY_CACHE_MS });
  return promise;
}

export function invalidateDailyGames(identity: string, category: GameCategoryId) {
  dailyRequests.delete(`${identity}:${category}`);
}
