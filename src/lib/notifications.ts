import { get, push, ref, remove, set, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { scheduleAcceptedFollowHonoursRecalculation, scheduleHonoursRecalculation } from "@/lib/honours-client";
import type { MovieLog, User } from "@/types";
import { shouldDeliverNotificationToUser } from "./settings";
import { sendPushNotification } from "./push-notifications";
import { getUserProfile } from "./users";

export type FollowRequestState = "pending" | "accepted";

export type NotificationType =
  | "follow_request"
  | "collaboration_request"
  | "like"
  | "share_reply"
  | "share_received"
  | "log_created"
  | "log_comment"
  | "log_comment_reply"
  | "log_comment_like"
  | "matcher_update"
  | "release_reminder"
  | "honour_unlocked";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  fromUser?: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  };
  createdAt: string;
  seen?: boolean;
  followRequestState?: FollowRequestState;
  followedBack?: boolean;
  ref_id?: string;
  listId?: string;
  listName?: string;
  logId?: string;
  commentId?: string;
  shareId?: string;
  shareTitle?: string;
  subjectUsername?: string;
  subjectName?: string;
  content?: string;
  contentId?: string | number;
  contentType?: string;
  title?: string;
  url?: string;
};

type NotificationActor = {
  id: string;
  username: string;
  name: string;
  avatar_url?: string | null;
};

function fallbackUser(userId: string): User {
  return {
    id: userId,
    username: userId,
    name: userId,
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

function stripUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedFields(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, stripUndefinedFields(fieldValue)])
    ) as T;
  }

  return value;
}

function sanitizeNotificationKeyPart(value: string): string {
  return value.replace(/[.#$/[\]]/g, "-");
}

export function parseNotificationItems(raw: unknown): NotificationItem[] {
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw as Record<string, Record<string, unknown>>)
    .filter(([, entry]) => entry.type !== "matcher_update")
    .map(([id, entry]) => ({
    id,
    type: entry.type as NotificationType,
    fromUser: entry.fromUser as NotificationItem["fromUser"],
    createdAt: (entry.createdAt as string | undefined) || (entry.created_at as string | undefined) || new Date().toISOString(),
    seen: entry.seen as boolean | undefined,
    followRequestState: entry.followRequestState as FollowRequestState | undefined,
    ref_id: entry.ref_id as string | undefined,
    listId: entry.listId as string | undefined,
    listName: entry.listName as string | undefined,
    logId: entry.logId as string | undefined,
    commentId: entry.commentId as string | undefined,
    shareId: entry.shareId as string | undefined,
    shareTitle: entry.shareTitle as string | undefined,
    subjectUsername: entry.subjectUsername as string | undefined,
    subjectName: entry.subjectName as string | undefined,
    content: entry.content as string | undefined,
    contentId: entry.contentId as string | number | undefined,
    contentType: entry.contentType as string | undefined,
    title: entry.title as string | undefined,
    url: entry.url as string | undefined,
  })) as NotificationItem[];
}

export function sortNotificationItems(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function notificationHref(note: NotificationItem): string {
  if (note.type === "honour_unlocked" && note.url) return note.url;
  if (note.type === "release_reminder" && note.contentId) return `/movie/${note.contentId}`;
  if (note.type === "collaboration_request" && note.listId) return `/lists/${note.listId}`;
  if (note.type === "share_reply" && note.shareId) {
    return `/share?share_id=${note.shareId}&panel=history`;
  }
  if (note.type === "share_received" && note.shareId) {
    return `/share?share_id=${note.shareId}&panel=history`;
  }
  if (note.type === "log_created" && note.logId) {
    return `/logs/${note.logId}`;
  }
  if ((note.type === "log_comment" || note.type === "log_comment_reply" || note.type === "log_comment_like") && note.logId) {
    return note.commentId ? `/logs/${note.logId}?comment=${note.commentId}` : `/logs/${note.logId}`;
  }
  if (note.type === "like" && note.logId) return `/logs/${note.logId}`;
  if (note.fromUser?.username) return `/profile/${note.fromUser.username}`;
  return "/dashboard";
}

export function notificationText(note: NotificationItem): string {
  switch (note.type) {
    case "release_reminder":
      return `${note.title || "A tracked movie"} has reached its release date.`;
    case "follow_request":
      return "is now following you.";
    case "collaboration_request":
      return `sent you a collaboration request${note.listName ? ` for ${note.listName}` : ""}.`;
    case "like":
      return "liked your log.";
    case "share_reply":
      return note.shareTitle ? `replied to your share of ${note.shareTitle}.` : "replied to your share.";
    case "share_received":
      return note.shareTitle ? `shared ${note.shareTitle} with you.` : "shared a title with you.";
    case "log_created":
      return note.contentType === "tv" ? "logged a new show." : "logged a new movie.";
    case "honour_unlocked":
      return note.title?.replace(/^Honour unlocked:\s*/i, "")
        ? `unlocked ${note.title.replace(/^Honour unlocked:\s*/i, "")}.`
        : "unlocked a Canisterr Honour.";
    case "log_comment":
      return "commented on your log.";
    case "log_comment_reply":
      return "replied to your log comment.";
    case "log_comment_like":
      return "liked your log comment.";
    default:
      return "sent you a notification.";
  }
}

export function formatNotificationDate(dateString: string, includeTime = false): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, includeTime ? {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  } : {
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function removeNotification(userId: string, notificationId: string): Promise<void> {
  await remove(ref(db, `notifications/${userId}/${notificationId}`));
}

export async function clearAllNotifications(userId: string): Promise<void> {
  await remove(ref(db, `notifications/${userId}`));
}

export async function clearSelectedNotifications(userId: string, notificationIds: string[]): Promise<void> {
  await Promise.all(notificationIds.map((notificationId) => removeNotification(userId, notificationId)));
}

export async function acceptFollowRequest(
  userId: string,
  note: NotificationItem,
  options?: { keepNotification?: boolean; actorUser?: NotificationActor }
): Promise<void> {
  const followRef = ref(db, `follows/${note.id}`);
  const followSnapshot = await get(followRef);
  if (followSnapshot.exists()) {
    await set(followRef, {
      ...followSnapshot.val(),
      status: "accepted",
    });
    scheduleAcceptedFollowHonoursRecalculation(note.id);
  }

  if (options?.keepNotification) {
    const notificationRef = ref(db, `notifications/${userId}/${note.id}`);
    const notificationSnapshot = await get(notificationRef);
    await set(
      notificationRef,
      stripUndefinedFields({
        ...(notificationSnapshot.exists() ? notificationSnapshot.val() : {}),
        ...note,
        followRequestState: "accepted",
        seen: true,
      })
    );
  } else {
    await removeNotification(userId, note.id);
  }

  if (!options?.actorUser || !note.fromUser || options.actorUser.id === note.fromUser.id) {
    return;
  }

  if (!(await shouldDeliverNotificationToUser(note.fromUser.id, "follow_request"))) {
    return;
  }

  const acceptedAt = new Date().toISOString();
  await set(
    ref(db, `notifications/${note.fromUser.id}/${note.id}`),
    stripUndefinedFields({
      type: "follow_request",
      seen: false,
      followRequestState: "accepted",
      followedBack: true,
      fromUser: {
        id: options.actorUser.id,
        username: options.actorUser.username,
        name: options.actorUser.name,
        avatar_url: options.actorUser.avatar_url || null,
      },
      created_at: acceptedAt,
      createdAt: acceptedAt,
    })
  );
}

export async function declineFollowRequest(userId: string, note: NotificationItem): Promise<void> {
  await Promise.all([
    remove(ref(db, `follows/${note.id}`)),
    removeNotification(userId, note.id),
  ]);
}

export async function sendFollowRequest(
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  targetUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  }
): Promise<void> {
  if (!fromUser || !targetUser || fromUser.id === targetUser.id) return;

  const followsRef = ref(db, "follows");
  const snapshot = await get(followsRef);

  if (snapshot.exists()) {
    const existingFollow = Object.values(snapshot.val() as Record<string, any>).find(
      (follow: any) =>
        follow?.follower_id === fromUser.id && follow?.following_id === targetUser.id
    );

    if (existingFollow) {
      return;
    }
  }

  const followId = `${fromUser.id}-${targetUser.id}-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const newFollow = {
    id: followId,
    follower_id: fromUser.id,
    following_id: targetUser.id,
    status: "accepted" as const,
    created_at: createdAt,
    createdAt,
  };

  await set(ref(db, `follows/${followId}`), newFollow);
  scheduleHonoursRecalculation(fromUser.id);

  if (await shouldDeliverNotificationToUser(targetUser.id, "follow_request")) {
    await set(
      ref(db, `notifications/${targetUser.id}/${followId}`),
      stripUndefinedFields({
        type: "follow_request",
        seen: false,
        followRequestState: "accepted",
        fromUser: {
          id: fromUser.id,
          username: fromUser.username,
          name: fromUser.name,
          avatar_url: fromUser.avatar_url || null,
        },
        created_at: createdAt,
        createdAt,
      })
    );

    await sendPushNotification({
      userId: targetUser.id,
      title: `${fromUser.name} is now following you`,
      body: "Open Canisterr to follow back or view their profile.",
      url: "/notifications",
      type: "follow_request",
      notificationId: followId,
    });
  }
}

export async function followBackUser(
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  targetUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  }
): Promise<void> {
  if (!fromUser || !targetUser || fromUser.id === targetUser.id) return;

  const followsRef = ref(db, "follows");
  const snapshot = await get(followsRef);

  let existingFollow: { id: string; createdAt?: string; created_at?: string } | null = null;
  let targetAlreadyFollowsActor = false;
  let targetFollowId: string | null = null;
  if (snapshot.exists()) {
    const allFollows = Object.entries(snapshot.val() as Record<string, any>);
    const ownRelation = allFollows.find(([, follow]) =>
      follow?.follower_id === fromUser.id && follow?.following_id === targetUser.id
    );
    if (ownRelation) existingFollow = { id: ownRelation[0], ...ownRelation[1] };
    const reciprocalRelation = allFollows.find(([, follow]) =>
      follow?.follower_id === targetUser.id && follow?.following_id === fromUser.id && follow?.status === "accepted"
    );
    targetFollowId = reciprocalRelation?.[0] || null;
    targetAlreadyFollowsActor = Boolean(targetFollowId);
  }

  const followId = existingFollow?.id || `${fromUser.id}-${targetUser.id}-${Date.now()}`;
  const createdAt = existingFollow?.createdAt || existingFollow?.created_at || new Date().toISOString();
  const acceptedFollow = {
    id: followId,
    follower_id: fromUser.id,
    following_id: targetUser.id,
    status: "accepted" as const,
    created_at: createdAt,
    createdAt,
  };

  await set(ref(db, `follows/${followId}`), acceptedFollow);
  if (targetFollowId) {
    const reciprocalNotificationRef = ref(db, `notifications/${targetUser.id}/${targetFollowId}`);
    const reciprocalNotification = await get(reciprocalNotificationRef);
    if (reciprocalNotification.exists()) {
      await update(reciprocalNotificationRef, { followedBack: true });
    }
  }
  await createFollowAcceptedNotification(targetUser.id, followId, fromUser, createdAt, targetAlreadyFollowsActor);
}

export async function createFollowRequestNotification(
  userId: string,
  followId: string,
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  createdAt: string
): Promise<void> {
  scheduleHonoursRecalculation(fromUser.id);
  if (!(await shouldDeliverNotificationToUser(userId, "follow_request"))) return;

  await set(
    ref(db, `notifications/${userId}/${followId}`),
    stripUndefinedFields({
      type: "follow_request",
      seen: false,
      followRequestState: "accepted",
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );

  await sendPushNotification({
    userId,
    title: `${fromUser.name} is now following you`,
    body: "Open Canisterr to follow back or view their profile.",
    url: "/notifications",
    type: "follow_request",
    notificationId: followId,
  });
}

export async function createFollowAcceptedNotification(
  userId: string,
  followId: string,
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  createdAt: string,
  followedBack = false
): Promise<void> {
  scheduleHonoursRecalculation(fromUser.id);
  if (!(await shouldDeliverNotificationToUser(userId, "follow_request"))) return;

  await set(
    ref(db, `notifications/${userId}/${followId}`),
    stripUndefinedFields({
      type: "follow_request",
      seen: false,
      followRequestState: "accepted",
      followedBack,
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );

  await sendPushNotification({
    userId,
    title: `${fromUser.name} is now following you`,
    body: "Open Canisterr to see who followed you back.",
    url: "/notifications",
    type: "follow_request",
    notificationId: followId,
  });
}

export async function createLogCreatedNotifications(log: MovieLog): Promise<void> {
  try {
    if (!log.id || !log.user_id || log.watch_later || !log.watched_date) return;

    const followsRef = ref(db, "follows");
    const snapshot = await get(followsRef);
    if (!snapshot.exists()) return;

    const followerIds = Array.from(
      new Set(
        Object.values(snapshot.val() as Record<string, any>)
          .filter((follow: any) => follow?.following_id === log.user_id && follow?.status === "accepted")
          .map((follow: any) => follow?.follower_id)
          .filter((followerId): followerId is string => Boolean(followerId) && followerId !== log.user_id)
      )
    );

    if (followerIds.length === 0) return;

    const fromUser = await getUserProfile(log.user_id);
    const createdAt = log.created_at || new Date().toISOString();
    const logTitle = log.content_type === "tv" ? "show" : "movie";

    await Promise.all(
      followerIds.map(async (recipientId) => {
        try {
          if (!(await shouldDeliverNotificationToUser(recipientId, "log_created", log.user_id))) return;

          const notificationRef = push(ref(db, `notifications/${recipientId}`));
          await set(
            notificationRef,
            stripUndefinedFields({
              type: "log_created",
              seen: false,
              logId: log.id,
              contentId: log.content_id,
              contentType: log.content_type,
              fromUser: {
                id: fromUser.id,
                username: fromUser.username,
                name: fromUser.name,
                avatar_url: fromUser.avatar_url || null,
              },
              created_at: createdAt,
              createdAt,
            })
          );

          await sendPushNotification({
            userId: recipientId,
            title: `${fromUser.name} logged a new ${logTitle}`,
            body: "Open Canisterr to view the log.",
            url: `/logs/${log.id}`,
            type: "log_created",
            notificationId: `${log.id}-${recipientId}`,
          });
        } catch (error) {
          console.warn("Failed to create log_created notification for recipient:", recipientId, error);
        }
      })
    );
  } catch (error) {
    console.warn("Failed to create log created notifications:", error);
  }
}

export async function createCollaborationRequestNotification(
  userId: string,
  listId: string,
  listName: string,
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  createdAt: string
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, "collaboration_request"))) return;

  const notificationId = sanitizeNotificationKeyPart(`${listId}-${fromUser.id}-${createdAt}`);

  await set(
    ref(db, `notifications/${userId}/${notificationId}`),
    stripUndefinedFields({
      type: "collaboration_request",
      seen: false,
      listId,
      listName,
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );

  await sendPushNotification({
    userId,
    title: `${fromUser.name} invited you to collaborate`,
    body: listName ? `Open Canisterr to join ${listName}.` : "Open Canisterr to view the invite.",
    url: `/lists/${listId}`,
    type: "collaboration_request",
    notificationId,
  });
}

export async function createShareReceivedNotification(
  userId: string,
  shareId: string,
  shareTitle: string,
  shareType: "movie" | "tv",
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  createdAt: string,
  note?: string | null
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, "share_received", fromUser.id))) return;

  const notificationRef = push(ref(db, `notifications/${userId}`));

  await set(
    notificationRef,
    stripUndefinedFields({
      type: "share_received",
      seen: false,
      shareId,
      shareTitle,
      contentType: shareType,
      content: note || undefined,
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );

  await sendPushNotification({
    userId,
    title: `${fromUser.name} shared a ${shareType === "tv" ? "show" : "movie"} with you`,
    body: shareTitle ? `Open Canisterr to see ${shareTitle}.` : "Open Canisterr to see the recommendation.",
    url: `/share?share_id=${shareId}&panel=history`,
    type: "share_received",
    notificationId: shareId,
  });
}

export async function createMatcherUpdateNotification(
  userId: string,
  fromUser: {
    id: string;
    username: string;
    name: string;
    avatar_url?: string | null;
  },
  subjectUsername: string,
  subjectName: string,
  createdAt: string
): Promise<void> {
  if (!(await shouldDeliverNotificationToUser(userId, "matcher_update"))) return;

  const notificationId = sanitizeNotificationKeyPart(`${fromUser.id}-${subjectUsername}-${createdAt}`);
  await set(
    ref(db, `notifications/${userId}/${notificationId}`),
    stripUndefinedFields({
      type: "matcher_update",
      seen: false,
      subjectUsername,
      subjectName,
      fromUser: {
        id: fromUser.id,
        username: fromUser.username,
        name: fromUser.name,
        avatar_url: fromUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    })
  );

  await sendPushNotification({
    userId,
    title: `${fromUser.name} checked your movie matcher`,
    body: "Open Canisterr to see the match report.",
    url: "/movie-matcher",
    type: "matcher_update",
    notificationId,
  });
}

export function createNotificationFallbackUser(userId: string): User {
  return fallbackUser(userId);
}
