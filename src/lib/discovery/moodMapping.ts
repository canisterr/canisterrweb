import type { DiscoveryMoodSlug, MoodDefinition } from "./discoveryTypes";

export const DISCOVERY_MOODS: MoodDefinition[] = [
  {
    slug: "comfort",
    name: "Comfort",
    reason: "Warm, familiar, low-stress viewing",
    genres: [
      { id: 35, name: "Comedy", priority: "primary" },
      { id: 10751, name: "Family", priority: "primary" },
      { id: 16, name: "Animation", priority: "secondary" },
      { id: 10770, name: "TV Movie", priority: "secondary" },
    ],
    keywordTerms: ["friendship", "feel-good", "small town", "family", "holiday", "coming of age", "slice of life", "homecoming", "childhood", "heartwarming", "christmas", "romance", "reunion"],
  },
  {
    slug: "lonely_reflective",
    name: "Lonely / Reflective",
    reason: "Character-led reflective movies",
    genres: [
      { id: 18, name: "Drama", priority: "primary" },
      { id: 99, name: "Documentary", priority: "secondary" },
      { id: 36, name: "History", priority: "secondary" },
    ],
    keywordTerms: ["loneliness", "solitude", "isolation", "friendship", "self discovery", "grief", "existentialism", "personal journey", "biography", "society", "identity", "human condition", "nature", "historical figure", "politics"],
  },
  {
    slug: "romantic",
    name: "Romantic",
    reason: "Core romance discovery",
    genres: [
      { id: 10749, name: "Romance", priority: "primary" },
      { id: 35, name: "Comedy", priority: "secondary" },
      { id: 18, name: "Drama", priority: "secondary" },
    ],
    keywordTerms: ["love", "falling in love", "relationship", "first love", "dating", "marriage", "breakup", "unrequited love", "romantic comedy", "meet cute", "wedding", "heartbreak", "forbidden love", "longing"],
  },
  {
    slug: "feel_good_funny",
    name: "Feel-Good / Funny",
    reason: "Fastest route to light entertainment",
    genres: [
      { id: 35, name: "Comedy", priority: "primary" },
      { id: 10402, name: "Music", priority: "primary" },
      { id: 16, name: "Animation", priority: "secondary" },
    ],
    keywordTerms: ["feel-good", "friendship", "buddy", "road trip", "workplace", "satire", "coming of age", "music", "band", "singer", "concert", "dance", "musical", "performance", "adventure", "family", "comedy", "talking animal"],
  },
  {
    slug: "adrenaline",
    name: "Adrenaline",
    reason: "High-energy movie selection",
    genres: [
      { id: 28, name: "Action", priority: "primary" },
      { id: 12, name: "Adventure", priority: "primary" },
      { id: 53, name: "Thriller", priority: "primary" },
      { id: 80, name: "Crime", priority: "secondary" },
      { id: 37, name: "Western", priority: "secondary" },
    ],
    keywordTerms: ["chase", "fight", "assassin", "revenge", "heist", "survival", "special forces", "martial arts", "expedition", "treasure hunt", "quest", "journey", "exploration", "suspense", "conspiracy", "hostage", "manhunt", "cat and mouse", "gangster", "robbery", "organized crime", "detective", "hitman", "gunslinger", "frontier", "outlaw", "duel"],
  },
  {
    slug: "mind_bending",
    name: "Mind-Bending",
    reason: "Concept-heavy movies that make the viewer solve things",
    genres: [
      { id: 878, name: "Science Fiction", priority: "primary" },
      { id: 9648, name: "Mystery", priority: "primary" },
      { id: 53, name: "Thriller", priority: "secondary" },
      { id: 14, name: "Fantasy", priority: "secondary" },
    ],
    keywordTerms: ["time travel", "artificial intelligence", "simulation", "alternate reality", "space", "dystopia", "memory", "mystery", "investigation", "missing person", "unreliable narrator", "secret", "puzzle", "psychological thriller", "paranoia", "twist ending", "obsession", "dream", "surrealism", "magic", "alternate world", "mythology", "supernatural"],
  },
  {
    slug: "dark_twisted",
    name: "Dark & Twisted",
    reason: "Fear, dread and disturbing themes",
    genres: [
      { id: 27, name: "Horror", priority: "primary" },
      { id: 80, name: "Crime", priority: "primary" },
      { id: 53, name: "Thriller", priority: "primary" },
      { id: 9648, name: "Mystery", priority: "secondary" },
    ],
    keywordTerms: ["supernatural", "possession", "serial killer", "haunted house", "body horror", "psychological horror", "cult", "murder", "corruption", "organized crime", "kidnapping", "revenge", "psychological thriller", "obsession", "stalking", "conspiracy", "survival", "murder mystery", "secret", "disappearance", "investigation"],
  },
  {
    slug: "emotional_cry",
    name: "Emotional / Cry",
    reason: "Emotion-first discovery",
    genres: [
      { id: 18, name: "Drama", priority: "primary" },
      { id: 10749, name: "Romance", priority: "primary" },
      { id: 10751, name: "Family", priority: "secondary" },
      { id: 10770, name: "TV Movie", priority: "secondary" },
    ],
    keywordTerms: ["grief", "loss", "terminal illness", "family", "sacrifice", "friendship", "tragedy", "redemption", "heartbreak", "forbidden love", "unrequited love", "separation", "marriage", "longing", "parent child relationship", "reunion", "childhood", "illness", "romance", "christmas"],
  },
  {
    slug: "beautiful_dreamy",
    name: "Beautiful / Dreamy",
    reason: "Atmospheric, imaginative cinema",
    genres: [
      { id: 14, name: "Fantasy", priority: "primary" },
      { id: 16, name: "Animation", priority: "primary" },
      { id: 10402, name: "Music", priority: "secondary" },
      { id: 18, name: "Drama", priority: "secondary" },
    ],
    keywordTerms: ["dream", "magical realism", "mythology", "fairy tale", "surrealism", "enchanted", "wonder", "visual storytelling", "fantasy", "nature", "friendship", "coming of age", "music", "dance", "performance", "musical", "artist", "concert", "art", "photography", "memory", "love", "self discovery"],
  },
  {
    slug: "epic_immersive",
    name: "Epic / Immersive",
    reason: "Large-scale journeys and worlds",
    genres: [
      { id: 12, name: "Adventure", priority: "primary" },
      { id: 878, name: "Science Fiction", priority: "primary" },
      { id: 14, name: "Fantasy", priority: "primary" },
      { id: 28, name: "Action", priority: "secondary" },
      { id: 36, name: "History", priority: "secondary" },
    ],
    keywordTerms: ["quest", "expedition", "journey", "survival", "exploration", "treasure hunt", "epic", "battle", "war", "hero", "rebellion", "rescue", "space opera", "alien", "future", "dystopia", "interplanetary", "space travel", "kingdom", "mythology", "magic", "prophecy", "sword and sorcery", "historical event", "empire", "king", "revolution", "biography", "ancient world"],
  },
];

export function getMoodDefinition(slug: DiscoveryMoodSlug): MoodDefinition {
  return DISCOVERY_MOODS.find((mood) => mood.slug === slug) || DISCOVERY_MOODS[0];
}
