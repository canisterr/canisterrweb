import type { MovieLogWithContent } from "@/types";
import type { TasteProfile } from "./types";

const PROFILE_VERSION = 1;

function addWeight(record: Record<string, number>, key: string | null | undefined, weight: number) {
  const normalized = key?.trim().toLowerCase();
  if (!normalized) return;
  record[normalized] = (record[normalized] || 0) + weight;
}

function verdictWeight(log: MovieLogWithContent): number {
  if (log.reaction === 2) return 1;
  if (log.reaction === 1) return 0.55;
  if (log.reaction === 1.5) return 0.1;
  if (log.reaction === 0) return -0.9;
  return 0.08;
}

function normalizeVector(vector: Record<string, number>): Record<string, number> {
  const maxMagnitude = Math.max(1, ...Object.values(vector).map((value) => Math.abs(value)));
  return Object.fromEntries(
    Object.entries(vector).map(([key, value]) => [key, Number((value / maxMagnitude).toFixed(4))])
  );
}

export function createTasteProfile(userId: string, logs: MovieLogWithContent[]): TasteProfile {
  const genreVector: Record<string, number> = {};
  const creatorAffinity: Record<string, number> = {};
  const languagePreferences: Record<string, number> = {};
  const moodVector: Record<string, number> = {};
  const watchedLogs = logs.filter((log) => !log.watch_later && Boolean(log.watched_date));

  watchedLogs.forEach((log, index) => {
    const recencyBoost = index < 12 ? 1.2 : 1;
    const weight = verdictWeight(log) * recencyBoost;
    (log.content.genres || []).forEach((genre) => addWeight(genreVector, String(genre), weight));
    addWeight(creatorAffinity, log.content.director, weight);
    addWeight(languagePreferences, log.content.language, Math.max(0.05, weight));
    addWeight(moodVector, log.mood || log.context_log?.mood, weight * 0.65);
  });

  return {
    userId,
    version: PROFILE_VERSION,
    genreVector: normalizeVector(genreVector),
    moodVector: normalizeVector(moodVector),
    themeVector: {},
    creatorAffinity: normalizeVector(creatorAffinity),
    languagePreferences: normalizeVector(languagePreferences),
    pacePreference: null,
    complexityPreference: null,
    noveltyPreference: 0.35,
    evidenceCount: watchedLogs.length,
    updatedAt: new Date().toISOString(),
  };
}

export function createColdStartTasteProfile(userId: string): TasteProfile {
  return createTasteProfile(userId, []);
}
