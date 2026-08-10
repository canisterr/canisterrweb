import { getTasteBasedPopularMovies, getMovieRecommendations } from "@/lib/movie-recommendations";
import { getUserWatchlist, getUserMovieLogs } from "@/lib/logs";
import { getFriendLogs } from "@/lib/friend-logs";
import { getFullTasteProfile } from "@/lib/friends-match";
import { calculateMatchScore, generateMatchAnalysis } from "@/lib/match-score";
import { getFollowingIds } from "@/lib/store/social";
import type { Content, MovieLogWithContent } from "@/types";
import type { PersonalizedSectionConfig, StoreMovieSummary } from "@/types/store";

function contentToSummary(content: Content): StoreMovieSummary | null {
  if (content.type === "tv") return null; // the 3D store is movie-only for now (TV uses non-TMDB ids)
  const year = content.release_date ? Number.parseInt(content.release_date.slice(0, 4), 10) : null;
  return {
    id: content.id,
    title: content.title,
    posterPath: null,
    releaseYear: Number.isFinite(year) ? year : null,
    rating: content.rating ?? null,
    posterUrl: content.poster_url,
  };
}

function logsToSummaries(logs: MovieLogWithContent[], limit: number): StoreMovieSummary[] {
  const seen = new Set<number>();
  const summaries: StoreMovieSummary[] = [];
  for (const log of logs) {
    if (!log.content) continue;
    const summary = contentToSummary(log.content);
    if (!summary || seen.has(summary.id)) continue;
    seen.add(summary.id);
    summaries.push(summary);
    if (summaries.length >= limit) break;
  }
  return summaries;
}

const MAX_TASTE_MATCH_CANDIDATES = 8;
const MAX_TASTE_MATCH_FRIENDS = 3;

async function getTasteMatchShelf(userId: string): Promise<StoreMovieSummary[]> {
  const followingIds = await getFollowingIds(userId);
  if (followingIds.length === 0) return [];

  const myTastes = await getFullTasteProfile(userId);
  if (myTastes.length === 0) return [];

  const candidates = followingIds.slice(0, MAX_TASTE_MATCH_CANDIDATES);
  const scored = await Promise.all(
    candidates.map(async (friendId) => {
      try {
        const friendTastes = await getFullTasteProfile(friendId);
        if (friendTastes.length === 0) return null;
        const { totalScore } = calculateMatchScore(myTastes, friendTastes);
        return { friendId, totalScore, friendTastes };
      } catch {
        return null;
      }
    })
  );

  const topFriends = scored
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_TASTE_MATCH_FRIENDS);

  if (topFriends.length === 0) return [];

  const analyses = await Promise.all(
    topFriends.map((friend) =>
      generateMatchAnalysis(myTastes, friend.friendTastes, userId, friend.friendId).catch(() => null)
    )
  );

  const seen = new Set<number>();
  const summaries: StoreMovieSummary[] = [];
  for (const analysis of analyses) {
    if (!analysis) continue;
    const shared = [...analysis.commonMasterpieceMovies, ...analysis.commonTasteMovies];
    for (const movie of shared) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      summaries.push({
        id: movie.id,
        title: movie.title,
        posterPath: null,
        releaseYear: null,
        rating: null,
        posterUrl: movie.poster_url,
      });
    }
  }
  return summaries;
}

/**
 * The Canisterr personalized area. Every entry maps 1:1 onto an existing,
 * already-shipped data function — nothing here is fabricated. Sections
 * gracefully resolve to [] when signed out or when there isn't enough
 * signal yet (e.g. a brand-new account with no logs).
 */
export const PERSONALIZED_SECTIONS: PersonalizedSectionConfig[] = [
  {
    id: "for-you",
    label: "For You",
    signage: "FOR YOU",
    mood: "warm",
    description: "Recommendations built from your taste profile.",
    fetch: async (userId) => {
      const content = await getTasteBasedPopularMovies(userId, 24);
      return content.map(contentToSummary).filter((movie): movie is StoreMovieSummary => movie !== null);
    },
  },
  {
    id: "watchlist",
    label: "Your Watchlist",
    signage: "WATCHLIST",
    mood: "neutral",
    description: "Movies you've saved to watch later.",
    fetch: async (userId) => {
      const logs = await getUserWatchlist(userId);
      return logsToSummaries(logs, 30);
    },
  },
  {
    id: "rated-highly",
    label: "Movies You Loved",
    signage: "YOU LOVED THESE",
    mood: "warm",
    description: "Movies you rated as a Masterpiece.",
    fetch: async (userId) => {
      const logs = await getUserMovieLogs(userId, 300);
      return logsToSummaries(
        logs.filter((log) => log.reaction === 2),
        30
      );
    },
  },
  {
    id: "friends-watching",
    label: "Friends Are Watching",
    signage: "FRIENDS ARE WATCHING",
    mood: "vibrant",
    description: "Recent activity from people you follow.",
    fetch: async (userId) => {
      const logs = await getFriendLogs(userId, { daysBack: 21, limit: 60 });
      return logsToSummaries(logs, 30);
    },
  },
  {
    id: "friends-loved",
    label: "Friends Loved These",
    signage: "FRIENDS LOVED THESE",
    mood: "vibrant",
    description: "Movies your friends rated as a Masterpiece.",
    fetch: async (userId) => {
      const logs = await getFriendLogs(userId, { daysBack: null, limit: 120 });
      return logsToSummaries(
        logs.filter((log) => log.reaction === 2),
        30
      );
    },
  },
  {
    id: "taste-match",
    label: "Taste Match",
    signage: "TASTE MATCH",
    mood: "cool",
    description: "Movies loved by the friends whose taste is closest to yours.",
    fetch: getTasteMatchShelf,
  },
  {
    id: "continue-exploring",
    label: "Continue Exploring",
    signage: "CONTINUE EXPLORING",
    mood: "neutral",
    description: "More picks based on your broader recommendation signals.",
    fetch: async (userId) => {
      const content = await getMovieRecommendations(userId, undefined, 24);
      return content.map(contentToSummary).filter((movie): movie is StoreMovieSummary => movie !== null);
    },
  },
];
