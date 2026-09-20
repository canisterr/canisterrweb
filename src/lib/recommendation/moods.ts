import type { RecommendationMood } from "./types";

export interface MoodDefinition {
  id: RecommendationMood;
  label: string;
  shortLabel: string;
  prompt: string;
  genreIds: number[];
  genres: string[];
  energy: number;
}

export const RECOMMENDATION_MOODS: MoodDefinition[] = [
  { id: "laugh", label: "Make me laugh", shortLabel: "Funny", prompt: "Light, sharp, and genuinely fun.", genreIds: [35], genres: ["Comedy"], energy: 0.55 },
  { id: "beautiful_sadness", label: "Beautiful sadness", shortLabel: "Bittersweet", prompt: "Tender stories that stay with you.", genreIds: [18, 10749], genres: ["Drama", "Romance"], energy: 0.35 },
  { id: "intense", label: "Something intense", shortLabel: "Intense", prompt: "Tension with no room to look away.", genreIds: [53, 80, 28], genres: ["Thriller", "Crime", "Action"], energy: 0.85 },
  { id: "comfort", label: "Comfort watch", shortLabel: "Comfort", prompt: "Warm, familiar, low-stress viewing.", genreIds: [35, 10751, 16], genres: ["Comedy", "Family", "Animation"], energy: 0.25 },
  { id: "mind_bending", label: "Mess with my head", shortLabel: "Mind-bending", prompt: "A puzzle worth your full attention.", genreIds: [878, 9648, 53], genres: ["Science Fiction", "Mystery", "Thriller"], energy: 0.8 },
  { id: "romantic", label: "Romantic", shortLabel: "Romantic", prompt: "Connection, longing, and chemistry.", genreIds: [10749, 18, 35], genres: ["Romance", "Drama", "Comedy"], energy: 0.4 },
  { id: "escapism", label: "Pure escapism", shortLabel: "Escape", prompt: "A world big enough to disappear into.", genreIds: [12, 14, 878, 28], genres: ["Adventure", "Fantasy", "Science Fiction", "Action"], energy: 0.75 },
  { id: "late_night", label: "Late-night thoughts", shortLabel: "Reflective", prompt: "Quiet, thoughtful, and a little haunting.", genreIds: [18, 9648], genres: ["Drama", "Mystery"], energy: 0.3 },
  { id: "inspiring", label: "Something inspiring", shortLabel: "Inspiring", prompt: "A story that leaves you moving forward.", genreIds: [18, 36, 99], genres: ["Drama", "History", "Documentary"], energy: 0.55 },
  { id: "surprise", label: "Surprise me", shortLabel: "Surprise", prompt: "A confident leap outside the obvious.", genreIds: [], genres: [], energy: 0.5 },
];

export function getMoodDefinition(mood: RecommendationMood | null): MoodDefinition | null {
  return RECOMMENDATION_MOODS.find((item) => item.id === mood) || null;
}
