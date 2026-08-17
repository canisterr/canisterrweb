import { db } from "@/lib/firebase";
import { ref, get, set, push, remove } from "firebase/database";
import type { User } from "@/types";
import { getUsersByIds } from "@/lib/users";
import { shouldDeliverNotificationToUser } from "@/lib/settings";

// Add a like to a log
export async function likeLog(logId: string, userId: string): Promise<void> {
  const likeRef = ref(db, `log_likes/${logId}/${userId}`);
  await set(likeRef, true);
}

// Like a log and notify the log's owner (if not liking your own log).
// Shared by every place a log can be liked so the notification only lives once.
export async function likeLogAndNotify(logId: string, logOwnerId: string, fromUser: User): Promise<void> {
  await likeLog(logId, fromUser.id);

  if (fromUser.id === logOwnerId) return;

  try {
    if (!(await shouldDeliverNotificationToUser(logOwnerId, "like"))) return;

    const notifRef = push(ref(db, `notifications/${logOwnerId}`));
    await set(notifRef, {
      type: "like",
      logId,
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Failed to create log like notification:", error);
  }
}

// Remove a like from a log
export async function unlikeLog(logId: string, userId: string): Promise<void> {
  const likeRef = ref(db, `log_likes/${logId}/${userId}`);
  await remove(likeRef);
}

// Get like count and whether the user liked
export async function getLogLikes(logId: string, userId: string): Promise<{ count: number; liked: boolean }> {
  const likesRef = ref(db, `log_likes/${logId}`);
  const snapshot = await get(likesRef);
  if (!snapshot.exists()) return { count: 0, liked: false };
  const likes = snapshot.val();
  const userLiked = !!likes[userId];
  return { count: Object.keys(likes).length, liked: userLiked };
}

// Get the users who liked a log
export async function getLogLikers(logId: string): Promise<User[]> {
  const likesRef = ref(db, `log_likes/${logId}`);
  const snapshot = await get(likesRef);
  if (!snapshot.exists()) return [];

  const userIds = Object.keys(snapshot.val() || {});
  const usersById = await getUsersByIds(userIds);
  return userIds.map((userId) => usersById[userId]);
}
