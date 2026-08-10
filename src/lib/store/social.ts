import { getUserFollowRecords } from "@/lib/profile";
import { getUsersByIds } from "@/lib/users";
import { getLogsForContent } from "@/lib/logs";
import type { MovieReactionValue, User } from "@/types";

/** IDs of users the given user actively follows (accepted follows only). Thin composition over profile.ts — no duplicate Firebase query. */
export async function getFollowingIds(userId: string): Promise<string[]> {
  const records = await getUserFollowRecords(userId);
  return Array.from(
    new Set(
      records
        .filter((record) => record.follower_id === userId && record.status === "accepted")
        .map((record) => record.following_id)
    )
  );
}

export interface FriendWatchEntry {
  user: User;
  reaction: MovieReactionValue | null;
}

/** Friends (accepted follows) who have logged this exact movie, with their reaction. Real data only. */
export async function getFriendsWhoWatched(userId: string, contentId: number): Promise<FriendWatchEntry[]> {
  const [followingIds, contentLogs] = await Promise.all([
    getFollowingIds(userId),
    getLogsForContent(contentId, "movie", 200),
  ]);

  if (followingIds.length === 0 || contentLogs.length === 0) return [];

  const followingSet = new Set(followingIds);
  const relevantLogs = contentLogs.filter((log) => followingSet.has(log.user_id));
  if (relevantLogs.length === 0) return [];

  const friendIds = Array.from(new Set(relevantLogs.map((log) => log.user_id)));
  const usersById = await getUsersByIds(friendIds);

  const entries: FriendWatchEntry[] = [];
  const seen = new Set<string>();
  for (const log of relevantLogs) {
    if (seen.has(log.user_id)) continue;
    const user = usersById[log.user_id];
    if (!user) continue;
    seen.add(log.user_id);
    entries.push({ user, reaction: log.reaction });
  }
  return entries;
}
