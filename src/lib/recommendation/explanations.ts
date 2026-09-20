import { getMoodDefinition } from "./moods";
import type { RecommendationCandidate, RecommendationContext, RecommendationScore, TasteProfile } from "./types";

function topMatchingGenre(candidate: RecommendationCandidate, profile: TasteProfile): string | null {
  return candidate.genres
    .slice()
    .sort((a, b) => (profile.genreVector[b.toLowerCase()] || 0) - (profile.genreVector[a.toLowerCase()] || 0))
    .find((genre) => (profile.genreVector[genre.toLowerCase()] || 0) > 0.15) || null;
}

export function buildRecommendationReason(
  candidate: RecommendationCandidate,
  score: RecommendationScore,
  context: RecommendationContext,
  profile: TasteProfile
): string {
  const mood = getMoodDefinition(context.mood);
  const genre = topMatchingGenre(candidate, profile);

  if (score.contextFit >= score.personalFit && context.availableMinutes && candidate.runtimeMinutes) {
    return `${candidate.runtimeMinutes} minutes fits the time you have, while keeping close to the ${mood?.shortLabel.toLowerCase() || "kind of"} night you chose.`;
  }
  if (score.moodMatch >= 0.72 && mood) {
    return `${mood.prompt} This lines up with the mood you picked tonight${genre ? ` and your interest in ${genre.toLowerCase()}` : ""}.`;
  }
  if (genre && profile.evidenceCount >= 4) {
    return `Your diary consistently leans toward ${genre.toLowerCase()}, and this is a strong fit without simply repeating what you already know.`;
  }
  if (context.noveltyLevel >= 0.65) {
    return "A deliberate step outside your usual picks, held in place by tonight’s mood and solid audience evidence.";
  }
  return "A balanced match for tonight based on your chosen mood, available time, and the evidence in your diary.";
}
