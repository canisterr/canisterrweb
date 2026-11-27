import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import type { User } from "@/types";
import { getUsersByIds } from "@/lib/users";

export type LogEngagementSnapshot = {
  likesCount: number;
  liked: boolean;
  likerPreview: User[];
  commentsCount: number;
  savesCount: number;
  saved: boolean;
};

const EMPTY_SNAPSHOT: LogEngagementSnapshot = {
  likesCount: 0,
  liked: false,
  likerPreview: [],
  commentsCount: 0,
  savesCount: 0,
  saved: false,
};

const LIKER_PREVIEW_SIZE = 3;

/**
 * Batches like/comment/save lookups for a set of logs into one round of parallel
 * reads plus a single de-duplicated user-resolution call, instead of each card
 * fetching its own engagement independently.
 */
export async function getLogEngagementBatch(
  logIds: string[],
  currentUserId?: string | null,
  options: { includeSaves?: boolean } = {}
): Promise<Record<string, LogEngagementSnapshot>> {
  const uniqueLogIds = Array.from(new Set(logIds.filter(Boolean)));
  if (uniqueLogIds.length === 0) return {};
  if (!currentUserId || currentUserId === "__guest__") {
    return Object.fromEntries(uniqueLogIds.map((logId) => [logId, getEmptyLogEngagement()]));
  }

  const reads = await Promise.all(
    uniqueLogIds.map(async (logId) => {
      const [likesResult, commentsResult, savesResult] = await Promise.allSettled([
        get(ref(db, `log_likes/${logId}`)),
        get(ref(db, `log_comments/${logId}`)),
        options.includeSaves === false ? Promise.resolve(null) : get(ref(db, `log_saves/${logId}`)),
      ]);
      const likesSnap = likesResult.status === "fulfilled" ? likesResult.value : null;
      const commentsSnap = commentsResult.status === "fulfilled" ? commentsResult.value : null;
      const savesSnap = savesResult.status === "fulfilled" ? savesResult.value : null;

      const likeUserIds = likesSnap?.exists() ? Object.keys(likesSnap.val() || {}) : [];
      const saves = savesSnap?.exists() ? savesSnap.val() : {};

      return {
        logId,
        likeUserIds,
        commentsCount: commentsSnap?.exists() ? Object.keys(commentsSnap.val() || {}).length : 0,
        savesCount: Object.keys(saves || {}).length,
        saved: currentUserId ? !!saves?.[currentUserId] : false,
      };
    })
  );

  const likerIdsToResolve = new Set<string>();
  reads.forEach((entry) => {
    entry.likeUserIds.slice(0, LIKER_PREVIEW_SIZE).forEach((id) => likerIdsToResolve.add(id));
  });

  const usersById = await getUsersByIds(Array.from(likerIdsToResolve));

  const result: Record<string, LogEngagementSnapshot> = {};
  reads.forEach((entry) => {
    result[entry.logId] = {
      likesCount: entry.likeUserIds.length,
      liked: currentUserId ? entry.likeUserIds.includes(currentUserId) : false,
      likerPreview: entry.likeUserIds
        .slice(0, LIKER_PREVIEW_SIZE)
        .map((id) => usersById[id])
        .filter((user): user is User => Boolean(user)),
      commentsCount: entry.commentsCount,
      savesCount: entry.savesCount,
      saved: entry.saved,
    };
  });

  return result;
}

export function getEmptyLogEngagement(): LogEngagementSnapshot {
  return { ...EMPTY_SNAPSHOT, likerPreview: [] };
}
