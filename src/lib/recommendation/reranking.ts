import { buildRecommendationReason } from "./explanations";
import { scoreCandidate, toTonightMatch } from "./ranking";
import type {
  RankedRecommendation,
  RecommendationCandidate,
  RecommendationContext,
  RecommendationLane,
  RecommendationMemoryEvent,
  TasteProfile,
} from "./types";

function laneValue(item: RankedRecommendation, lane: RecommendationLane): number {
  if (lane === "safe") return item.score.finalScore * 0.55 + item.score.personalFit * 0.3 + item.score.confidence * 0.15;
  if (lane === "stretch") return item.score.finalScore * 0.5 + item.score.discoveryValue * 0.28 + item.score.globalQuality * 0.22;
  return item.score.moodMatch * 0.35 + item.score.globalQuality * 0.3 + (1 - item.score.personalFit) * 0.25 + item.score.contextFit * 0.1;
}

function primaryGenre(item: RankedRecommendation): string {
  return item.candidate.genres[0]?.toLowerCase() || `${item.candidate.contentType}:${item.candidate.id}`;
}

export function rankAndRerankCandidates(
  candidates: RecommendationCandidate[],
  context: RecommendationContext,
  profile: TasteProfile,
  memory: RecommendationMemoryEvent[]
): RankedRecommendation[] {
  const base = candidates.map((candidate) => {
    const score = scoreCandidate(candidate, context, profile, memory);
    return {
      candidate,
      score,
      lane: "safe" as RecommendationLane,
      tonightMatch: toTonightMatch(score),
      reason: buildRecommendationReason(candidate, score, context, profile),
    };
  }).filter((item) => item.score.negativePreferencePenalty < 0.9 && item.score.finalScore > 0.12);

  const selected: RankedRecommendation[] = [];
  const usedKeys = new Set<string>();
  const usedGenres = new Set<string>();

  (["safe", "stretch", "wildcard"] as RecommendationLane[]).forEach((lane) => {
    const choice = base
      .filter((item) => !usedKeys.has(`${item.candidate.contentType}:${item.candidate.id}`))
      .sort((a, b) => laneValue(b, lane) - laneValue(a, lane))
      .find((item) => !usedGenres.has(primaryGenre(item)))
      || base.filter((item) => !usedKeys.has(`${item.candidate.contentType}:${item.candidate.id}`)).sort((a, b) => laneValue(b, lane) - laneValue(a, lane))[0];

    if (!choice) return;
    const ranked = { ...choice, lane };
    selected.push(ranked);
    usedKeys.add(`${choice.candidate.contentType}:${choice.candidate.id}`);
    usedGenres.add(primaryGenre(choice));
  });

  const remainder = base
    .filter((item) => !usedKeys.has(`${item.candidate.contentType}:${item.candidate.id}`))
    .sort((a, b) => b.score.finalScore - a.score.finalScore);
  return [...selected, ...remainder];
}
