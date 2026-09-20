import { getUserMovieLogs } from "@/lib/logs";
import type { User } from "@/types";
import { generateCandidates } from "./candidate-generator";
import { getRecommendationMemory, saveTasteProfile } from "./feedback";
import { rankAndRerankCandidates } from "./reranking";
import { createColdStartTasteProfile, createTasteProfile } from "./taste-profile";
import type { RankedRecommendation, RecommendationContext, TasteProfile } from "./types";

export interface RecommendationResult {
  recommendations: RankedRecommendation[];
  tasteProfile: TasteProfile;
  memoryCount: number;
}

export async function getRecommendationsForContext(
  user: User | null,
  context: RecommendationContext,
  additionalExcludedKeys: Set<string> = new Set()
): Promise<RecommendationResult> {
  const [logs, memory] = user
    ? await Promise.all([getUserMovieLogs(user.id, 240, user), getRecommendationMemory(user.id)])
    : [[], []];
  const tasteProfile = user ? createTasteProfile(user.id, logs) : createColdStartTasteProfile("guest");

  if (user) {
    void saveTasteProfile(tasteProfile).catch(() => {});
  }

  const watchedKeys = new Set(
    logs
      .filter((log) => !log.watch_later && Boolean(log.watched_date))
      .map((log) => `${log.content_type}:${log.content_id}`)
  );
  const excludedKeys = new Set([...watchedKeys, ...additionalExcludedKeys]);
  const candidates = await generateCandidates({ context, tasteProfile, excludedKeys });
  const recommendations = rankAndRerankCandidates(candidates, context, tasteProfile, memory);

  return { recommendations, tasteProfile, memoryCount: memory.length };
}

export function createDefaultRecommendationContext(region = "IN"): RecommendationContext {
  return {
    mood: null,
    availableMinutes: null,
    contentType: "either",
    watchingWith: null,
    energyLevel: 0.5,
    noveltyLevel: 0.35,
    providerIds: [],
    region,
    sessionTimestamp: new Date().toISOString(),
  };
}
