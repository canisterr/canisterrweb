import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { UserTasteWithContent } from "@/types";
import { getUserTasteProfile } from "./user-taste";
import { normalizeUserRecord, getUsersByIds } from "./users";
import { getAllTasteSignatures, getTasteSignature } from "./taste-signature";
import { calculateMatchScore } from "./match-score";

export interface Friend {
  userId: string;
  username: string;
  name: string;
  avatar_url: string | null;
  tasteCount: number;
  isComplete: boolean;
}

/**
 * Get all users who have a minimum taste profile (7+ movies).
 *
 * Counts come from the cached taste_signatures node (a handful of flat RTDB
 * reads) instead of re-enriching every taste item of every user with a live
 * TMDB call — that used to happen on every render of this list. Users who
 * haven't had a signature computed yet (pre-migration) fall back to a raw
 * count from user_tastes, which is still just a flat read, no enrichment.
 */
export async function getAvailableFriends(
  currentUserId: string
): Promise<Friend[]> {
  try {
    const [signatures, rawTastesSnapshot] = await Promise.all([
      getAllTasteSignatures(),
      get(ref(db, "user_tastes")),
    ]);

    const fallbackCounts = new Map<string, number>();
    if (rawTastesSnapshot.exists()) {
      Object.values(rawTastesSnapshot.val() as Record<string, { user_id: string }>).forEach((taste) => {
        fallbackCounts.set(taste.user_id, (fallbackCounts.get(taste.user_id) || 0) + 1);
      });
    }

    const userIds = Array.from(
      new Set([...Object.keys(signatures), ...fallbackCounts.keys()])
    ).filter((userId) => userId !== currentUserId);

    const usersData = await getUsersByIds(userIds);
    const friends: Friend[] = [];

    userIds.forEach((userId) => {
      const userData = usersData[userId];
      if (!userData) return;

      const tasteCount = signatures[userId]?.tasteCount ?? fallbackCounts.get(userId) ?? 0;
      const isComplete = tasteCount >= 7;
      const normalized = normalizeUserRecord(userId, userData);

      friends.push({
        userId,
        username: normalized.username,
        name: normalized.name,
        avatar_url: normalized.avatar_url,
        tasteCount,
        isComplete,
      });
    });

    return friends.sort((a, b) => b.tasteCount - a.tasteCount);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return [];
  }
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  name: string;
  avatar_url: string | null;
  tasteCount: number;
  totalScore: number;
}

/**
 * Rank every friend with a complete profile by match score against the
 * current user. Pure math over cached taste_signatures (calculateMatchScore),
 * no per-friend TMDB enrichment — the leaderboard is only fast because Phase
 * 1's signature cache exists; scoring every friend used to mean re-fetching
 * and re-enriching everyone's full taste profile on every click.
 *
 * Friends without a cached signature yet (never triggered a recompute) are
 * skipped rather than computed on the spot, to keep this a handful of RTDB
 * reads instead of reintroducing a bulk TMDB fetch.
 */
export async function getFriendLeaderboard(currentUserId: string): Promise<LeaderboardEntry[]> {
  try {
    const [friends, mySignature, signatures] = await Promise.all([
      getAvailableFriends(currentUserId),
      getTasteSignature(currentUserId),
      getAllTasteSignatures(),
    ]);

    if (mySignature.tasteCount === 0) return [];

    return friends
      .filter((friend) => friend.isComplete)
      .map((friend) => {
        const friendSignature = signatures[friend.userId];
        if (!friendSignature) return null;

        const { totalScore } = calculateMatchScore(mySignature, friendSignature);
        return {
          userId: friend.userId,
          username: friend.username,
          name: friend.name,
          avatar_url: friend.avatar_url,
          tasteCount: friend.tasteCount,
          totalScore,
        };
      })
      .filter((entry): entry is LeaderboardEntry => entry !== null)
      .sort((a, b) => b.totalScore - a.totalScore);
  } catch (error) {
    console.error("Error building friend leaderboard:", error);
    return [];
  }
}

/**
 * Get a specific user's taste profile
 */
export async function getFriendTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFriendTasteProfile: Fetching for user", userId);
    const tastes = await getUserTasteProfile(userId);
    console.log("getFriendTasteProfile: Got", tastes.length, "tastes");
    return tastes;
  } catch (error) {
    console.error("Error fetching friend taste profile:", error);
    return [];
  }
}

/**
 * Get the matcher taste profile.
 * We keep this focused on the explicit taste picks so compatibility reflects
 * what the user actually chose to represent their taste.
 */
export async function getFullTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFullTasteProfile: Fetching for user", userId);

    const tasteProfile = await getUserTasteProfile(userId);
    console.log("getFullTasteProfile: Returning", tasteProfile.length, "taste profile items");
    return tasteProfile;
  } catch (error) {
    console.error("Error fetching full taste profile:", error);
    return [];
  }
}
