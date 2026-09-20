export type RecommendationContentType = "movie" | "tv";
export type ContentPreference = RecommendationContentType | "either";

export type RecommendationMood =
  | "laugh"
  | "beautiful_sadness"
  | "intense"
  | "comfort"
  | "mind_bending"
  | "romantic"
  | "escapism"
  | "late_night"
  | "inspiring"
  | "surprise";

export type RecommendationLane = "safe" | "stretch" | "wildcard";
export type RecommendationFeedbackAction =
  | "shown"
  | "accepted"
  | "saved"
  | "seen"
  | "not_tonight"
  | "not_for_me"
  | "another"
  | "details_opened";

export interface RecommendationContext {
  mood: RecommendationMood | null;
  availableMinutes: number | null;
  contentType: ContentPreference;
  watchingWith: "solo" | "together" | null;
  energyLevel: number;
  noveltyLevel: number;
  providerIds: number[];
  region: string;
  sessionTimestamp: string;
}

export interface WatchProviderOption {
  id: number;
  name: string;
}

export interface TasteProfile {
  userId: string;
  version: number;
  genreVector: Record<string, number>;
  moodVector: Record<string, number>;
  themeVector: Record<string, number>;
  creatorAffinity: Record<string, number>;
  languagePreferences: Record<string, number>;
  pacePreference: number | null;
  complexityPreference: number | null;
  noveltyPreference: number;
  evidenceCount: number;
  updatedAt: string;
}

export interface RecommendationCandidate {
  id: number;
  contentType: RecommendationContentType;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  genreIds: number[];
  language: string | null;
  creator: string | null;
  rating: number | null;
  voteCount: number | null;
  popularity: number | null;
  providerIds: number[];
  providerNames: string[];
  source: "tmdb" | "tvmaze";
}

export interface RecommendationScore {
  personalFit: number;
  contextFit: number;
  moodMatch: number;
  discoveryValue: number;
  globalQuality: number;
  confidence: number;
  repetitionPenalty: number;
  negativePreferencePenalty: number;
  finalScore: number;
}

export interface RankedRecommendation {
  candidate: RecommendationCandidate;
  score: RecommendationScore;
  lane: RecommendationLane;
  tonightMatch: number;
  reason: string;
}

export interface RecommendationMemoryEvent {
  id?: string;
  userId: string;
  sessionId: string;
  contentId: number;
  contentType: RecommendationContentType;
  source: string;
  action: RecommendationFeedbackAction;
  recommendationScore: number;
  context: RecommendationContext;
  timestamp: string;
}

export interface RecommendationSessionRecord {
  id: string;
  userId: string;
  context: RecommendationContext;
  createdAt: string;
  acceptedContentId: number | null;
  status: "active" | "accepted" | "ended";
}

export interface CandidateGenerationInput {
  context: RecommendationContext;
  tasteProfile: TasteProfile;
  excludedKeys: Set<string>;
  page?: number;
}
