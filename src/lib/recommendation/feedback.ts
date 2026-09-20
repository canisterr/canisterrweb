import { get, push, ref, set, update } from "firebase/database";
import { db } from "@/lib/firebase";
import type {
  RecommendationFeedbackAction,
  RecommendationMemoryEvent,
  RecommendationSessionRecord,
  RankedRecommendation,
  RecommendationContext,
  TasteProfile,
} from "./types";

export async function saveTasteProfile(profile: TasteProfile): Promise<void> {
  if (!profile.userId) return;
  await set(ref(db, `taste_profiles/${profile.userId}`), profile);
}

export async function getRecommendationMemory(userId: string): Promise<RecommendationMemoryEvent[]> {
  if (!userId) return [];
  try {
    const snapshot = await get(ref(db, `recommendation_events/${userId}`));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val() as Record<string, Omit<RecommendationMemoryEvent, "id">>)
      .map(([id, event]) => ({ ...event, id }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 250);
  } catch {
    return [];
  }
}

export async function createRecommendationSession(userId: string, context: RecommendationContext): Promise<string> {
  if (!userId) return `guest-${Date.now()}`;
  const sessionRef = push(ref(db, `recommendation_sessions/${userId}`));
  const sessionId = sessionRef.key;
  if (!sessionId) throw new Error("Could not create recommendation session");
  const record: RecommendationSessionRecord = {
    id: sessionId,
    userId,
    context,
    createdAt: new Date().toISOString(),
    acceptedContentId: null,
    status: "active",
  };
  await set(sessionRef, record);
  return sessionId;
}

export async function recordRecommendationEvent(input: {
  userId: string;
  sessionId: string;
  recommendation: RankedRecommendation;
  action: RecommendationFeedbackAction;
  context: RecommendationContext;
}): Promise<void> {
  if (!input.userId) return;
  const eventRef = push(ref(db, `recommendation_events/${input.userId}`));
  const event: RecommendationMemoryEvent = {
    userId: input.userId,
    sessionId: input.sessionId,
    contentId: input.recommendation.candidate.id,
    contentType: input.recommendation.candidate.contentType,
    source: input.recommendation.lane,
    action: input.action,
    recommendationScore: input.recommendation.score.finalScore,
    context: input.context,
    timestamp: new Date().toISOString(),
  };
  await set(eventRef, event);

  if (input.action === "accepted") {
    await update(ref(db, `recommendation_sessions/${input.userId}/${input.sessionId}`), {
      acceptedContentId: input.recommendation.candidate.id,
      status: "accepted",
    });
  }
}
