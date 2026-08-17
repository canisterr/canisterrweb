import { get, ref, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { UserTasteWithContent } from "@/types";
import { getUserTasteProfile } from "@/lib/user-taste";
import { getUserMovieLogs } from "@/lib/logs";

/**
 * A single taste data point: an explicit taste pick, or a masterpiece-rated
 * log promoted into the taste profile. See buildTasteProfileForScoring.
 */
export type MatchTaste = UserTasteWithContent;

/**
 * Precomputed, cacheable summary of one user's taste profile. Pure aggregate
 * data — no raw movie objects — so it's cheap to store and cheap to compare
 * against another user's signature (calculateMatchScore in match-score.ts)
 * without re-fetching or re-enriching anything.
 */
export interface TasteSignature {
  genreAffinities: Record<string, number>;
  keywordAffinities: Record<string, number>;
  studioAffinities: Record<string, number>;
  creators: string[]; // "dir:name" / "act:name"
  languages: string[];
  avgYear: number;
  avgPolarity: number;
  polarityVariance: number; // "picky vs generous" rater signal
  recentMoodPolarity: number | null;
  genreDiversityCount: number;
  contentIds: string[]; // "type-id", for exact-overlap scoring
  masterpieceContentIds: string[];
  tasteCount: number;
  updatedAt: string;
}

const EMPTY_SIGNATURE: TasteSignature = {
  genreAffinities: {},
  keywordAffinities: {},
  studioAffinities: {},
  creators: [],
  languages: [],
  avgYear: 2020,
  avgPolarity: 0,
  polarityVariance: 0,
  recentMoodPolarity: null,
  genreDiversityCount: 0,
  contentIds: [],
  masterpieceContentIds: [],
  tasteCount: 0,
  updatedAt: new Date(0).toISOString(),
};

function getContentField(taste: MatchTaste, field: "genres" | "keywords" | "studios"): string[] {
  const content = taste.content as any;
  if (!content || !Array.isArray(content[field])) return [];
  const values = Array.from(
    new Set(
      content[field]
        .map((value: string) => String(value).trim().toLowerCase())
        .filter(Boolean)
    )
  ) as string[];
  // Keywords are numerous and long-tail; cap so a handful of ultra-specific
  // tags don't dominate the affinity map for a single movie.
  return field === "keywords" ? values.slice(0, 8) : values;
}

function getReactionWeight(reaction?: 0 | 1 | 1.5 | 2): number {
  if (reaction === 2) return 1.7;
  if (reaction === 1) return 0.85;
  if (reaction === 1.5) return 0.3;
  if (reaction === 0) return -1.15;
  return 0.55;
}

function getSourceWeight(taste: MatchTaste): number {
  return taste.source === "log" ? 1.15 : 0.95;
}

function getRecencyWeight(addedAt?: string): number {
  if (!addedAt) return 1;
  const timestamp = new Date(addedAt).getTime();
  if (Number.isNaN(timestamp)) return 1;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
  return 1 / (1 + ageDays / 90);
}

function getReviewSentiment(notes?: string | null): number {
  if (!notes) return 0;

  const positiveTerms = [
    "love", "loved", "amazing", "awesome", "beautiful", "brilliant", "excellent",
    "favorite", "favourite", "great", "good", "incredible", "masterpiece",
    "perfect", "wonderful", "fantastic", "solid", "nice", "enjoyed",
  ];

  const negativeTerms = [
    "bad", "boring", "awful", "terrible", "hate", "hated", "weak", "messy",
    "slow", "dull", "mid", "mess", "poor", "worse", "worst", "disappointing",
    "forgettable",
  ];

  const text = notes.toLowerCase();
  let score = 0;
  positiveTerms.forEach((term) => {
    if (text.includes(term)) score += 1;
  });
  negativeTerms.forEach((term) => {
    if (text.includes(term)) score -= 1;
  });

  return Math.max(-1, Math.min(1, score / 4));
}

function getTastePolarity(taste: MatchTaste): number {
  const reaction = getReactionWeight(taste.reaction);
  const sentiment = getReviewSentiment(taste.notes);
  return reaction + sentiment * 0.85;
}

function getTasteInfluence(taste: MatchTaste): number {
  const polarity = getTastePolarity(taste);
  const recency = getRecencyWeight(taste.added_at);
  const source = getSourceWeight(taste);
  return polarity * recency * source;
}

function buildWeightedAffinities(
  tastes: MatchTaste[],
  field: "genres" | "keywords" | "studios"
): Map<string, number> {
  const weights = new Map<string, number>();

  tastes.forEach((taste) => {
    const values = getContentField(taste, field);
    if (values.length === 0) return;

    const itemWeight = getTasteInfluence(taste);
    const spread = itemWeight / Math.sqrt(values.length);

    values.forEach((value) => {
      weights.set(value, (weights.get(value) || 0) + spread);
    });
  });

  const affinities = new Map<string, number>();
  weights.forEach((value, key) => {
    const stabilized = value / 2.4;
    affinities.set(key, 1 / (1 + Math.exp(-stabilized)));
  });

  return affinities;
}

function mapToRecord(map: Map<string, number>): Record<string, number> {
  const record: Record<string, number> = {};
  map.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function getUserCreators(tastes: MatchTaste[]): Set<string> {
  const creators = new Set<string>();

  tastes.forEach((taste) => {
    const content = taste.content as any;
    if (!content) return;

    if (content.director) {
      creators.add(`dir:${String(content.director).toLowerCase()}`);
    }

    if (Array.isArray(content.actors)) {
      content.actors.forEach((actor: string) => {
        creators.add(`act:${String(actor).toLowerCase()}`);
      });
    }
  });

  return creators;
}

function getAverageYear(tastes: MatchTaste[]): number {
  if (tastes.length === 0) return 2020;

  let totalYear = 0;
  let count = 0;

  tastes.forEach((taste) => {
    const content = taste.content as any;
    if (content?.release_date) {
      const year = new Date(content.release_date).getFullYear();
      if (!Number.isNaN(year)) {
        totalYear += year;
        count += 1;
      }
    }
  });

  return count > 0 ? totalYear / count : 2020;
}

function getUserLanguages(tastes: MatchTaste[]): Set<string> {
  const languages = new Set<string>();

  tastes.forEach((taste) => {
    const content = taste.content as any;
    if (content?.language) {
      languages.add(String(content.language).toLowerCase());
    }
  });

  return languages;
}

function averageTastePolarity(tastes: MatchTaste[]): number {
  if (tastes.length === 0) return 0;

  let total = 0;
  let totalWeight = 0;

  tastes.forEach((taste) => {
    const weight = Math.max(0.25, getRecencyWeight(taste.added_at) * getSourceWeight(taste));
    total += getTastePolarity(taste) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? total / totalWeight : 0;
}

function computePolarityVariance(tastes: MatchTaste[]): number {
  if (tastes.length === 0) return 0;

  const polarities = tastes.map(getTastePolarity);
  const mean = polarities.reduce((sum, value) => sum + value, 0) / polarities.length;
  const variance =
    polarities.reduce((sum, value) => sum + (value - mean) ** 2, 0) / polarities.length;

  return variance;
}

function averageRecentTasteMood(tastes: MatchTaste[], limit = 5): number | null {
  const recent = [...tastes]
    .filter((taste) => taste.added_at || taste.reaction !== undefined || taste.notes)
    .sort((a, b) => new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime())
    .slice(0, limit);

  if (recent.length === 0) return null;

  let total = 0;
  let totalWeight = 0;

  recent.forEach((taste, index) => {
    const polarity = getTastePolarity(taste);
    const recency = getRecencyWeight(taste.added_at);
    const decay = Math.max(0.5, 1 - index * 0.08);
    const weight = Math.max(0.2, recency * decay);
    total += polarity * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? total / totalWeight : null;
}

/**
 * Pure aggregation: turn a raw list of taste items into a comparable
 * TasteSignature. No I/O — safe to call on already-fetched data.
 */
export function computeTasteSignature(tastes: MatchTaste[]): TasteSignature {
  if (tastes.length === 0) return { ...EMPTY_SIGNATURE, updatedAt: new Date().toISOString() };

  const genreAffinities = mapToRecord(buildWeightedAffinities(tastes, "genres"));
  const keywordAffinities = mapToRecord(buildWeightedAffinities(tastes, "keywords"));
  const studioAffinities = mapToRecord(buildWeightedAffinities(tastes, "studios"));

  const contentIds = Array.from(new Set(tastes.map((t) => `${t.content_type}-${t.content_id}`)));
  const masterpieceContentIds = Array.from(
    new Set(
      tastes
        .filter((t) => t.reaction === 2)
        .map((t) => `${t.content_type}-${t.content_id}`)
    )
  );

  return {
    genreAffinities,
    keywordAffinities,
    studioAffinities,
    creators: Array.from(getUserCreators(tastes)),
    languages: Array.from(getUserLanguages(tastes)),
    avgYear: getAverageYear(tastes),
    avgPolarity: averageTastePolarity(tastes),
    polarityVariance: computePolarityVariance(tastes),
    recentMoodPolarity: averageRecentTasteMood(tastes),
    genreDiversityCount: Math.min(Object.keys(genreAffinities).length, 10),
    contentIds,
    masterpieceContentIds,
    tasteCount: tastes.length,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The taste profile used for matching: explicit taste picks plus
 * masterpiece-rated logs not already in the explicit picks, symmetric for
 * whichever user it's built for. Reaction/source are set explicitly on the
 * masterpiece items so they carry proper weight in getTasteInfluence — a
 * previous version of this merge (done ad hoc in the matcher page) dropped
 * reaction, so masterpieces scored as neutral picks instead of masterpieces.
 */
export async function buildTasteProfileForScoring(userId: string): Promise<MatchTaste[]> {
  const [explicitTastes, logs] = await Promise.all([
    getUserTasteProfile(userId),
    getUserMovieLogs(userId, 200),
  ]);

  const explicitIds = new Set(explicitTastes.map((t) => t.content_id));

  const masterpieces: MatchTaste[] = logs
    .filter((log) => log.reaction === 2 && log.content && !explicitIds.has(log.content_id))
    .map((log) => ({
      id: `masterpiece-${log.id}`,
      user_id: log.user_id,
      content_id: log.content_id,
      content_type: log.content_type,
      added_at: log.watched_date,
      content: log.content,
      reaction: log.reaction ?? undefined,
      notes: log.notes ?? null,
      source: "log",
    }));

  return [
    ...explicitTastes.map((t) => ({ ...t, source: t.source ?? ("taste" as const) })),
    ...masterpieces,
  ];
}

export async function recomputeTasteSignature(userId: string): Promise<TasteSignature> {
  const tastes = await buildTasteProfileForScoring(userId);
  const signature = computeTasteSignature(tastes);

  try {
    await set(ref(db, `taste_signatures/${userId}`), signature);
  } catch (error) {
    console.error("recomputeTasteSignature: failed to persist", userId, error);
  }

  return signature;
}

export async function getTasteSignature(userId: string): Promise<TasteSignature> {
  try {
    const snapshot = await get(ref(db, `taste_signatures/${userId}`));
    if (snapshot.exists()) {
      return snapshot.val() as TasteSignature;
    }
  } catch (error) {
    console.error("getTasteSignature: read failed", userId, error);
  }

  return recomputeTasteSignature(userId);
}

/**
 * Bulk read of every cached signature, keyed by userId. Used by the friends
 * list / leaderboard so counting/scoring across many users stays a handful of
 * flat RTDB reads instead of one TMDB enrichment call per movie per user.
 */
export async function getAllTasteSignatures(): Promise<Record<string, TasteSignature>> {
  try {
    const snapshot = await get(ref(db, "taste_signatures"));
    return snapshot.exists() ? (snapshot.val() as Record<string, TasteSignature>) : {};
  } catch (error) {
    console.error("getAllTasteSignatures: read failed", error);
    return {};
  }
}
