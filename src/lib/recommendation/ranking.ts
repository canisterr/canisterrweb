import { getMoodDefinition } from "./moods";
import type {
  RecommendationCandidate,
  RecommendationContext,
  RecommendationMemoryEvent,
  RecommendationScore,
  TasteProfile,
} from "./types";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizedGenreTaste(candidate: RecommendationCandidate, profile: TasteProfile): number {
  if (!candidate.genres.length || profile.evidenceCount === 0) return 0.5;
  const weights = candidate.genres.map((genre) => profile.genreVector[genre.toLowerCase()] || 0);
  return clamp(0.5 + weights.reduce((sum, value) => sum + value, 0) / Math.max(2, weights.length * 2));
}

function getMoodMatch(candidate: RecommendationCandidate, context: RecommendationContext): number {
  const mood = getMoodDefinition(context.mood);
  if (!mood || mood.id === "surprise") return 0.62;
  const candidateNames = new Set(candidate.genres.map((genre) => genre.toLowerCase()));
  const nameHits = mood.genres.filter((genre) => candidateNames.has(genre.toLowerCase())).length;
  const idHits = candidate.genreIds.filter((id) => mood.genreIds.includes(id)).length;
  return clamp(0.28 + Math.max(nameHits, idHits) / Math.max(1, Math.min(3, mood.genres.length)) * 0.72);
}

function getContextFit(candidate: RecommendationCandidate, context: RecommendationContext): number {
  let score = 0.58;
  if (context.contentType !== "either") score += candidate.contentType === context.contentType ? 0.18 : -0.45;
  if (context.availableMinutes && candidate.runtimeMinutes) {
    const difference = context.availableMinutes - candidate.runtimeMinutes;
    score += difference >= 0 ? clamp(0.18 - difference / 500, 0.03, 0.18) : -clamp(Math.abs(difference) / 90, 0.12, 0.5);
  }
  const moodEnergy = getMoodDefinition(context.mood)?.energy;
  if (typeof moodEnergy === "number") score += 0.14 * (1 - Math.abs(moodEnergy - context.energyLevel));
  if (context.providerIds.length) {
    score += candidate.providerIds.some((providerId) => context.providerIds.includes(providerId)) ? 0.16 : -0.08;
  }
  return clamp(score);
}

function getGlobalQuality(candidate: RecommendationCandidate): number {
  const rating = candidate.rating ? clamp((candidate.rating - 4.5) / 4.5) : 0.42;
  const evidence = candidate.voteCount ? clamp(Math.log10(candidate.voteCount + 1) / 4) : 0.35;
  return clamp(rating * 0.78 + evidence * 0.22);
}

function getMemoryPenalties(candidate: RecommendationCandidate, memory: RecommendationMemoryEvent[]) {
  const events = memory.filter((event) => event.contentId === candidate.id && event.contentType === candidate.contentType);
  const now = Date.now();
  let repetitionPenalty = 0;
  let negativePreferencePenalty = 0;

  events.forEach((event) => {
    const ageDays = Math.max(0, (now - new Date(event.timestamp).getTime()) / 86_400_000);
    if (event.action === "not_for_me") negativePreferencePenalty = Math.max(negativePreferencePenalty, 1);
    if (event.action === "seen") negativePreferencePenalty = Math.max(negativePreferencePenalty, 0.9);
    if (event.action === "not_tonight" && ageDays < 3) repetitionPenalty = Math.max(repetitionPenalty, 0.85);
    if ((event.action === "shown" || event.action === "another") && ageDays < 7) repetitionPenalty = Math.max(repetitionPenalty, 0.5 * (1 - ageDays / 7));
  });

  return { repetitionPenalty, negativePreferencePenalty };
}

export function scoreCandidate(
  candidate: RecommendationCandidate,
  context: RecommendationContext,
  profile: TasteProfile,
  memory: RecommendationMemoryEvent[]
): RecommendationScore {
  const personalFit = normalizedGenreTaste(candidate, profile);
  const contextFit = getContextFit(candidate, context);
  const moodMatch = getMoodMatch(candidate, context);
  const globalQuality = getGlobalQuality(candidate);
  const noveltyDistance = 1 - personalFit;
  const discoveryValue = clamp(1 - Math.abs(noveltyDistance - context.noveltyLevel));
  const confidence = clamp(0.42 + Math.min(profile.evidenceCount, 30) / 75 + (candidate.voteCount ? 0.12 : 0));
  const { repetitionPenalty, negativePreferencePenalty } = getMemoryPenalties(candidate, memory);

  // Personal and tonight context lead. Global quality is a prior, never the recommendation itself.
  const weighted = personalFit * 0.3 + contextFit * 0.25 + moodMatch * 0.22 + discoveryValue * 0.11 + globalQuality * 0.12;
  const finalScore = clamp(weighted - repetitionPenalty * 0.42 - negativePreferencePenalty * 0.75);

  return {
    personalFit,
    contextFit,
    moodMatch,
    discoveryValue,
    globalQuality,
    confidence,
    repetitionPenalty,
    negativePreferencePenalty,
    finalScore,
  };
}

export function toTonightMatch(score: RecommendationScore): number {
  const calibrated = 54 + score.finalScore * 40;
  const confidenceAdjustment = (score.confidence - 0.5) * 6;
  return Math.round(clamp(calibrated + confidenceAdjustment, 55, 96));
}
