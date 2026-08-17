import { getUserMovieLogs } from "@/lib/logs";
import type { MovieLogWithContent } from "@/types";
import {
  computeTasteSignature,
  type MatchTaste,
  type TasteSignature,
} from "@/lib/taste-signature";
import { getMatchScoreHistory, recordMatchScorePoint, type MatchScorePoint } from "@/lib/match-history";

export type { MatchTaste };

function calculateProfileConfidence(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const minCount = Math.min(signatureA.tasteCount, signatureB.tasteCount);
  return 0.9 + 0.1 * (1 - Math.exp(-minCount / 12));
}

function calculateExactOverlap(signatureA: TasteSignature, signatureB: TasteSignature): number {
  if (signatureA.contentIds.length === 0 || signatureB.contentIds.length === 0) return 0;

  const idsA = new Set(signatureA.contentIds);
  let shared = 0;
  signatureB.contentIds.forEach((id) => {
    if (idsA.has(id)) shared += 1;
  });

  const denominator = Math.max(1, Math.min(signatureA.contentIds.length, signatureB.contentIds.length));
  return Math.min(1, shared / denominator);
}

/**
 * Calculate GenreSim (0-1)
 * Weighted genre affinity similarity between two precomputed signatures.
 */
export function calculateGenreSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const profileA = signatureA.genreAffinities;
  const profileB = signatureB.genreAffinities;

  const allGenres = new Set([...Object.keys(profileA), ...Object.keys(profileB)]);
  if (allGenres.size === 0) return 0;

  let similarity = 0;
  let totalWeight = 0;
  allGenres.forEach((genre) => {
    const affinityA = profileA[genre] ?? 0.5;
    const affinityB = profileB[genre] ?? 0.5;
    const diff = Math.min(1, Math.abs(affinityA - affinityB));
    const strength = Math.max(Math.abs(affinityA - 0.5), Math.abs(affinityB - 0.5));
    const weight = 0.35 + strength;
    similarity += (1 - diff) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? Math.max(0, Math.min(1, similarity / totalWeight)) : 0;
}

/**
 * Calculate RatingSim (0-1)
 * Blends two things: how similar the users' average reaction polarity is
 * (do you like the same movies), and how similar their rating *style* is —
 * polarityVariance distinguishes a "picky" rater (reserves strong reactions
 * for a few titles) from a "generous" one (rates everything strongly) even
 * when their average polarity happens to land in the same place.
 */
export function calculateRatingSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  if (signatureA.tasteCount === 0 || signatureB.tasteCount === 0) return 0;

  const normalizedDiff = Math.min(3, Math.abs(signatureA.avgPolarity - signatureB.avgPolarity));
  const polarityMatch = Math.max(0, 1 - normalizedDiff / 3);

  const varianceDiff = Math.min(4, Math.abs(signatureA.polarityVariance - signatureB.polarityVariance));
  const styleMatch = Math.max(0, 1 - varianceDiff / 4);

  return polarityMatch * 0.75 + styleMatch * 0.25;
}

/**
 * Calculate VibeSim (0-1)
 * Based on recent taste mood, falling back to genre diversity overlap.
 */
export function calculateVibeSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const vibeA = signatureA.recentMoodPolarity;
  const vibeB = signatureB.recentMoodPolarity;

  if (vibeA === null || vibeB === null) {
    if (signatureA.genreDiversityCount === 0 || signatureB.genreDiversityCount === 0) return 0;

    const diversityA = signatureA.genreDiversityCount / 10;
    const diversityB = signatureB.genreDiversityCount / 10;
    return ((diversityA + diversityB) / 2) * 0.7 + 0.3;
  }

  const diff = Math.min(3, Math.abs(vibeA - vibeB));
  return Math.max(0, 1 - diff / 3);
}

/**
 * Calculate CreatorSim (0-1)
 * Jaccard similarity of actors + directors. Boosted because shared creators
 * are very meaningful.
 */
export function calculateCreatorSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const creatorsA = new Set(signatureA.creators);
  const creatorsB = new Set(signatureB.creators);

  if (creatorsA.size === 0 || creatorsB.size === 0) return 0;

  const intersection = Array.from(creatorsA).filter((c) => creatorsB.has(c));
  const union = new Set([...creatorsA, ...creatorsB]);
  const jaccard = intersection.length / union.size;

  return Math.min(1, jaccard * 2.5);
}

/**
 * Calculate EraSim (0-1)
 * Based on average release year difference. Within 20 years = 100% match,
 * at 40 years = 50% match.
 */
export function calculateEraSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const yearDiff = Math.abs(signatureA.avgYear - signatureB.avgYear);
  return Math.max(0, 1 - yearDiff / 40);
}

/**
 * Calculate LanguageSim (0-1)
 * Jaccard similarity of languages, boosted because a shared language
 * preference is meaningful.
 */
export function calculateLanguageSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const languagesA = new Set(signatureA.languages);
  const languagesB = new Set(signatureB.languages);

  if (languagesA.size === 0 || languagesB.size === 0) return 0;

  const intersection = Array.from(languagesA).filter((l) => languagesB.has(l));
  const union = new Set([...languagesA, ...languagesB]);
  const jaccard = intersection.length / union.size;

  return Math.min(1, jaccard * 2.0);
}

/**
 * Keys where a user's affinity is meaningfully positive (not just "present
 * because it defaulted to neutral"). Keywords and studios are large, sparse
 * vocabularies compared to the ~19-value genre taxonomy, so comparing them
 * as a Jaccard overlap of genuinely-liked tags (like creators/languages)
 * makes more sense than the affinity-diff shape used for GenreSim.
 */
function strongAffinityKeys(affinities: Record<string, number>, threshold = 0.55): Set<string> {
  return new Set(Object.keys(affinities).filter((key) => affinities[key] >= threshold));
}

/**
 * Calculate KeywordSim (0-1)
 * Jaccard similarity of theme/plot keywords both users gravitate toward —
 * catches "vibe" matches genre alone misses (e.g. both love slow-burn heist
 * films, even across different genres).
 */
export function calculateKeywordSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const keysA = strongAffinityKeys(signatureA.keywordAffinities);
  const keysB = strongAffinityKeys(signatureB.keywordAffinities);

  if (keysA.size === 0 || keysB.size === 0) return 0;

  const intersection = Array.from(keysA).filter((k) => keysB.has(k));
  const union = new Set([...keysA, ...keysB]);
  const jaccard = intersection.length / union.size;

  return Math.min(1, jaccard * 2.2);
}

/**
 * Calculate StudioSim (0-1)
 * Jaccard similarity of production studios both users gravitate toward
 * (A24, Ghibli, Marvel, ...) — often a stronger identity signal than genre.
 */
export function calculateStudioSim(signatureA: TasteSignature, signatureB: TasteSignature): number {
  const studiosA = strongAffinityKeys(signatureA.studioAffinities);
  const studiosB = strongAffinityKeys(signatureB.studioAffinities);

  if (studiosA.size === 0 || studiosB.size === 0) return 0;

  const intersection = Array.from(studiosA).filter((s) => studiosB.has(s));
  const union = new Set([...studiosA, ...studiosB]);
  const jaccard = intersection.length / union.size;

  return Math.min(1, jaccard * 2.2);
}

export type MatchConfidence = "low" | "medium" | "high";

/**
 * Qualitative confidence label surfaced directly to the UI so a 62% built
 * from 8 movies doesn't read the same as a 62% built from 80 — previously
 * profile size only nudged the score itself (calculateProfileConfidence)
 * with no visible signal of how much to trust it.
 */
function getConfidenceLabel(signatureA: TasteSignature, signatureB: TasteSignature): MatchConfidence {
  const minCount = Math.min(signatureA.tasteCount, signatureB.tasteCount);
  if (minCount < 10) return "low";
  if (minCount < 30) return "medium";
  return "high";
}

/**
 * Calculate overall match score (0-100) from two precomputed taste
 * signatures. Pure math — no fetching, no enrichment — so it's cheap enough
 * to run for every friend in a leaderboard, not just one pair at a time.
 *
 * Weights: GenreSim 32% + KeywordSim 16% + CreatorSim 16% + RatingSim 14% +
 * VibeSim 8% + StudioSim 6% + EraSim 6% + LanguageSim 2%, scaled by profile
 * confidence, plus a direct exact-overlap boost for movies both users
 * actually share.
 */
export interface MatchScoreBreakdown {
  genreSim: number;
  keywordSim: number;
  ratingSim: number;
  vibeSim: number;
  creatorSim: number;
  studioSim: number;
  eraSim: number;
  languageSim: number;
  totalScore: number;
  confidence: MatchConfidence;
}

export interface MatchAnalysis extends MatchScoreBreakdown {
  blendPersonality: string;

  sharedGenres: string[];
  genreMismatch: string | null;

  commonTasteMovies: Array<{
    id: number;
    title: string;
    poster_url: string | null;
    type: "movie" | "tv";
  }>;
  commonTasteMovieCount: number;

  commonMasterpieceMovies: Array<{
    id: number;
    title: string;
    poster_url: string | null;
    type: "movie" | "tv";
  }>;
  commonMasterpieceMovieCount: number;

  commonActors: string[];
  commonDirectors: string[];
  topSharedCreator: string | null;

  genreDistributionA: { genre: string; count: number }[];
  genreDistributionB: { genre: string; count: number }[];
  dominantGenreA: string | null;
  dominantGenreB: string | null;

  avgYearA: number;
  avgYearB: number;
  languagesA: string[];
  languagesB: string[];
  sharedLanguages: string[];

  contrarianMovies: ContrarianMovie[];
  contrarianBadge: boolean;

  watchTimeMinutesA: number;
  watchTimeMinutesB: number;
  totalLoggedA: number;
  totalLoggedB: number;

  recommendationsForA: CrossRecommendation[];
  recommendationsForB: CrossRecommendation[];

  scoreHistory: MatchScorePoint[];

  tasteInsight: string;
}

export function calculateMatchScore(
  signatureA: TasteSignature,
  signatureB: TasteSignature
): MatchScoreBreakdown {
  if (signatureA.tasteCount === 0 || signatureB.tasteCount === 0) {
    return {
      genreSim: 0,
      keywordSim: 0,
      ratingSim: 0,
      vibeSim: 0,
      creatorSim: 0,
      studioSim: 0,
      eraSim: 0,
      languageSim: 0,
      totalScore: 0,
      confidence: "low",
    };
  }

  const genreSim = calculateGenreSim(signatureA, signatureB);
  const keywordSim = calculateKeywordSim(signatureA, signatureB);
  const ratingSim = calculateRatingSim(signatureA, signatureB);
  const vibeSim = calculateVibeSim(signatureA, signatureB);
  const creatorSim = calculateCreatorSim(signatureA, signatureB);
  const studioSim = calculateStudioSim(signatureA, signatureB);
  const eraSim = calculateEraSim(signatureA, signatureB);
  const languageSim = calculateLanguageSim(signatureA, signatureB);

  const exactOverlap = calculateExactOverlap(signatureA, signatureB);
  const confidenceMultiplier = calculateProfileConfidence(signatureA, signatureB);
  const weightedScore =
    0.32 * genreSim +
    0.16 * keywordSim +
    0.16 * creatorSim +
    0.14 * ratingSim +
    0.08 * vibeSim +
    0.06 * studioSim +
    0.06 * eraSim +
    0.02 * languageSim;
  const overlapBoost = exactOverlap * 0.28;
  const totalScore = 100 * Math.min(1, weightedScore * confidenceMultiplier + overlapBoost);

  return {
    genreSim: Math.round(genreSim * 100),
    keywordSim: Math.round(keywordSim * 100),
    ratingSim: Math.round(ratingSim * 100),
    vibeSim: Math.round(vibeSim * 100),
    creatorSim: Math.round(creatorSim * 100),
    studioSim: Math.round(studioSim * 100),
    eraSim: Math.round(eraSim * 100),
    languageSim: Math.round(languageSim * 100),
    totalScore: Math.round(totalScore),
    confidence: getConfidenceLabel(signatureA, signatureB),
  };
}

/**
 * Get genre distribution from tastes (for display, not scoring)
 */
function getGenreDistribution(tastes: MatchTaste[]): { genre: string; count: number }[] {
  const genreCounts = new Map<string, number>();

  tastes.forEach((taste) => {
    if (taste.content && Array.isArray((taste.content as any).genres)) {
      const genres = (taste.content as any).genres;
      genres.forEach((genre: string) => {
        const g = genre.toLowerCase();
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
    }
  });

  return Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate personality tag based on dominant genres
 */
function generateBlendPersonality(
  distributionA: { genre: string; count: number }[],
  distributionB: { genre: string; count: number }[]
): string {
  if (distributionA.length === 0 || distributionB.length === 0) return "Movie Enthusiasts";

  const topA = distributionA[0]?.genre || "";
  const topB = distributionB[0]?.genre || "";

  if (topA === topB) {
    return `${topA.charAt(0).toUpperCase() + topA.slice(1)} Devotees`;
  }

  return `${topA.charAt(0).toUpperCase() + topA.slice(1)} & ${topB.charAt(0).toUpperCase() + topB.slice(1)} Mix`;
}

/**
 * Get common masterpiece movies between two users from their already-fetched
 * logs. Filters to only show movies both users have rated as masterpiece
 * (reaction === 2). Takes logs rather than userIds so generateMatchAnalysis
 * can fetch each user's logs once and reuse them for this and the watch-time
 * summary below, instead of fetching twice.
 */
function getCommonMasterpieceMovies(
  logsA: MovieLogWithContent[],
  logsB: MovieLogWithContent[]
): Array<{
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
}> {
  const masterpieceA = logsA.filter((log) => log.reaction === 2);
  const masterpieceB = logsB.filter((log) => log.reaction === 2);

  const idsA = new Set(masterpieceA.map((log) => `${log.content_type}-${log.content_id}`));
  const commonIds = new Set(
    masterpieceB
      .filter((log) => idsA.has(`${log.content_type}-${log.content_id}`))
      .map((log) => `${log.content_type}-${log.content_id}`)
  );

  return masterpieceA
    .filter((log) => commonIds.has(`${log.content_type}-${log.content_id}`))
    .map((log) => ({
      id: log.content_id,
      title: (log.content as any)?.title || (log.content as any)?.name || "Unknown",
      poster_url: (log.content as any)?.poster_url || null,
      type: (log.content_type as "movie" | "tv") || "movie",
    }))
    .filter((movie, index, self) => index === self.findIndex((m) => m.id === movie.id && m.type === movie.type));
}

/**
 * Total logs and estimated watch time, mirroring the same formula the
 * profile Stats page uses (estimatedWatchTimeMinutes in getDetailedUserStats,
 * profile.ts) — sum of content runtime across watched, non-watchlist logs —
 * but computed from logs already fetched here instead of a second full pass.
 */
function summarizeWatchTime(logs: MovieLogWithContent[]): {
  totalLogged: number;
  estimatedWatchTimeMinutes: number;
} {
  let estimatedWatchTimeMinutes = 0;

  logs.forEach((log) => {
    if (log.watch_later || !log.watched_date) return;
    const runtime = Number((log.content as any)?.runtime);
    if (Number.isFinite(runtime) && runtime > 0) {
      estimatedWatchTimeMinutes += runtime;
    }
  });

  return { totalLogged: logs.length, estimatedWatchTimeMinutes };
}

/**
 * Get common taste profile movies between two users
 * Returns movies that are in BOTH users' taste profiles
 */
export function getCommonTasteMovies(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): Array<{
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
}> {
  const idsA = new Set(userATastes.map((t) => t.content_id));
  const commonIds = new Set(
    userBTastes.filter((t) => idsA.has(t.content_id)).map((t) => t.content_id)
  );

  return userATastes
    .filter((t) => commonIds.has(t.content_id))
    .map((taste) => ({
      id: taste.content_id,
      title: (taste.content as any)?.title || (taste.content as any)?.name || "Unknown",
      poster_url: (taste.content as any)?.poster_url || null,
      type: (taste.content_type as "movie" | "tv") || "movie",
    }));
}

/**
 * "Contrarian Buddies": movies both users rated highly (good/average/
 * masterpiece) that TMDB's crowd rated poorly (< 5). Reads straight off the
 * already-fetched taste content instead of a fresh TMDB call per shared
 * movie, unlike the original version of this feature.
 */
export interface ContrarianMovie {
  id: number;
  title: string;
  poster_url: string | null;
  tmdbRating: number;
  type: "movie" | "tv";
}

function getContrarianMovies(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): ContrarianMovie[] {
  const highReactions = new Set([2, 1, 1.5]);
  const highA = userATastes.filter((t) => highReactions.has(t.reaction as number));
  const highIdsB = new Set(
    userBTastes
      .filter((t) => highReactions.has(t.reaction as number))
      .map((t) => `${t.content_type}-${t.content_id}`)
  );

  const contrarian: ContrarianMovie[] = [];
  const seen = new Set<number>();

  highA.forEach((taste) => {
    if (seen.has(taste.content_id)) return;
    if (!highIdsB.has(`${taste.content_type}-${taste.content_id}`)) return;

    const content = taste.content as any;
    const rating = Number(content?.rating);
    if (!content || !Number.isFinite(rating) || rating >= 5) return;

    seen.add(taste.content_id);
    contrarian.push({
      id: taste.content_id,
      title: content.title || content.name || "Unknown",
      poster_url: content.poster_url || null,
      tmdbRating: rating,
      type: (taste.content_type as "movie" | "tv") || "movie",
    });
  });

  return contrarian;
}

export interface CrossRecommendation {
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
  reason: string;
}

/**
 * Score a single piece of content against a signature's genre/keyword/
 * creator affinities. Same building blocks as the *Sim functions above, just
 * applied to one candidate instead of comparing two full profiles.
 */
function scoreContentAgainstSignature(content: any, signature: TasteSignature): number {
  if (!content) return 0;
  let score = 0;

  const genres: string[] = Array.isArray(content.genres)
    ? content.genres.map((g: string) => String(g).toLowerCase())
    : [];
  genres.forEach((genre) => {
    const affinity = signature.genreAffinities[genre];
    if (affinity !== undefined) score += (affinity - 0.5) * 40;
  });

  const keywords: string[] = Array.isArray(content.keywords)
    ? content.keywords.slice(0, 8).map((k: string) => String(k).toLowerCase())
    : [];
  keywords.forEach((keyword) => {
    const affinity = signature.keywordAffinities[keyword];
    if (affinity !== undefined) score += (affinity - 0.5) * 30;
  });

  if (content.director && signature.creators.includes(`dir:${String(content.director).toLowerCase()}`)) {
    score += 25;
  }

  if (Array.isArray(content.actors)) {
    content.actors.forEach((actor: string) => {
      if (signature.creators.includes(`act:${String(actor).toLowerCase()}`)) {
        score += 10;
      }
    });
  }

  return score;
}

/**
 * "You might love" — the other user's masterpiece/good-rated titles that
 * aren't already in my taste profile, ranked by how well they fit *my*
 * signature. Cross-recommendation, not overlap: the existing common-movies
 * rails only surface titles both users already share.
 */
function getCrossRecommendations(
  targetSignature: TasteSignature,
  targetTastes: MatchTaste[],
  sourceTastes: MatchTaste[],
  limit = 8
): CrossRecommendation[] {
  const targetIds = new Set(targetTastes.map((t) => `${t.content_type}-${t.content_id}`));
  const seen = new Set<number>();

  const candidates = sourceTastes.filter((taste) => {
    if (taste.reaction !== 2 && taste.reaction !== 1) return false;
    if (targetIds.has(`${taste.content_type}-${taste.content_id}`)) return false;
    if (seen.has(taste.content_id)) return false;
    if (!taste.content) return false;
    seen.add(taste.content_id);
    return true;
  });

  return candidates
    .map((taste) => ({ taste, score: scoreContentAgainstSignature(taste.content, targetSignature) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ taste, score }) => {
      const content = taste.content as any;
      return {
        id: taste.content_id,
        title: content.title || content.name || "Unknown",
        poster_url: content.poster_url || null,
        type: (taste.content_type as "movie" | "tv") || "movie",
        reason: score > 15 ? "Matches your taste" : taste.reaction === 2 ? "Their masterpiece pick" : "Worth a shot",
      };
    });
}

/**
 * Generate comprehensive match analysis. Still takes raw taste arrays (not
 * signatures) because the report needs actual movie titles/posters/creator
 * names for display, not just aggregates — the signatures used for the score
 * itself are derived from these same arrays via computeTasteSignature.
 */
export async function generateMatchAnalysis(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[],
  userAId: string,
  userBId: string
): Promise<MatchAnalysis> {
  const hasInsufficientTasteData = userATastes.length === 0 || userBTastes.length === 0;

  const signatureA = computeTasteSignature(userATastes);
  const signatureB = computeTasteSignature(userBTastes);
  const score = calculateMatchScore(signatureA, signatureB);

  const genreDistA = getGenreDistribution(userATastes);
  const genreDistB = getGenreDistribution(userBTastes);

  const genresA = new Set(genreDistA.map((g) => g.genre));
  const genresB = new Set(genreDistB.map((g) => g.genre));
  const sharedGenres = Array.from(genresA).filter((g) => genresB.has(g));
  const uniqueA = Array.from(genresA).filter((g) => !genresB.has(g));
  const genreMismatch = uniqueA.length > 0 ? uniqueA[0] : null;

  const creatorsA = new Set(signatureA.creators);
  const creatorsB = new Set(signatureB.creators);
  const commonCreators = Array.from(creatorsA).filter((c) => creatorsB.has(c));
  const commonActors = commonCreators.filter((c) => c.startsWith("act:")).map((c) => c.slice(4));
  const commonDirectors = commonCreators.filter((c) => c.startsWith("dir:")).map((c) => c.slice(4));
  const topSharedCreator = commonCreators.length > 0 ? commonCreators[0] : null;

  const commonTasteMovies = getCommonTasteMovies(userATastes, userBTastes);

  let commonMasterpieceMovies: ReturnType<typeof getCommonMasterpieceMovies> = [];
  let watchTimeMinutesA = 0;
  let watchTimeMinutesB = 0;
  let totalLoggedA = 0;
  let totalLoggedB = 0;

  try {
    const [logsA, logsB] = await Promise.all([
      getUserMovieLogs(userAId, 500),
      getUserMovieLogs(userBId, 500),
    ]);

    commonMasterpieceMovies = getCommonMasterpieceMovies(logsA, logsB);

    const watchTimeA = summarizeWatchTime(logsA);
    const watchTimeB = summarizeWatchTime(logsB);
    watchTimeMinutesA = watchTimeA.estimatedWatchTimeMinutes;
    watchTimeMinutesB = watchTimeB.estimatedWatchTimeMinutes;
    totalLoggedA = watchTimeA.totalLogged;
    totalLoggedB = watchTimeB.totalLogged;
  } catch (error) {
    console.error("generateMatchAnalysis: failed to load logs for both users:", error);
  }

  const sharedLangs = signatureA.languages.filter((l) => signatureB.languages.includes(l));
  const contrarianMovies = getContrarianMovies(userATastes, userBTastes);
  const recommendationsForA = getCrossRecommendations(signatureA, userATastes, userBTastes);
  const recommendationsForB = getCrossRecommendations(signatureB, userBTastes, userATastes);

  let scoreHistory: MatchScorePoint[] = [];
  if (!hasInsufficientTasteData) {
    await recordMatchScorePoint(userAId, userBId, score.totalScore);
    scoreHistory = await getMatchScoreHistory(userAId, userBId);
  }

  const tasteInsight = hasInsufficientTasteData
    ? "Not enough taste data yet"
    : score.totalScore >= 75
    ? "You're cinematic soulmates!"
    : score.totalScore >= 50
    ? "Great taste overlap with some unique differences"
    : "Interesting contrast - learn from each other!";

  return {
    ...score,
    blendPersonality: generateBlendPersonality(genreDistA, genreDistB),
    sharedGenres,
    genreMismatch,
    commonTasteMovies,
    commonTasteMovieCount: commonTasteMovies.length,
    commonMasterpieceMovies,
    commonMasterpieceMovieCount: commonMasterpieceMovies.length,
    commonActors,
    commonDirectors,
    topSharedCreator,
    genreDistributionA: genreDistA,
    genreDistributionB: genreDistB,
    dominantGenreA: genreDistA[0]?.genre || null,
    dominantGenreB: genreDistB[0]?.genre || null,
    avgYearA: Math.round(signatureA.avgYear),
    avgYearB: Math.round(signatureB.avgYear),
    languagesA: signatureA.languages,
    languagesB: signatureB.languages,
    sharedLanguages: sharedLangs,
    contrarianMovies,
    contrarianBadge: contrarianMovies.length > 0,
    watchTimeMinutesA,
    watchTimeMinutesB,
    totalLoggedA,
    totalLoggedB,
    recommendationsForA,
    recommendationsForB,
    scoreHistory,
    tasteInsight,
  };
}
