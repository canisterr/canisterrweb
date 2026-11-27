import "server-only";

import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFrom(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

function values<T>(snapshot: { val(): unknown }): Record<string, T> {
  const value = snapshot.val();
  return value && typeof value === "object" ? value as Record<string, T> : {};
}

export async function POST(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json({ error: "Sign in again to delete your account." }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAuth(getFirebaseAdminApp()).verifyIdToken(token, true)).uid;
  } catch {
    return NextResponse.json({ error: "Your session expired. Sign in again and retry." }, { status: 401 });
  }

  try {
    const db = getFirebaseAdminDatabase();
    const [userSnapshot, logsSnapshot, watchedSnapshot, tastesSnapshot, followsSnapshot, sharesSnapshot,
      listsSnapshot, listItemsSnapshot, collaboratorsSnapshot, commentsSnapshot, likesSnapshot,
      savesSnapshot, commentLikesSnapshot, shareRepliesSnapshot, notificationsSnapshot] = await Promise.all([
      db.ref(`users/${uid}`).get(),
      db.ref("movie_logs").get(),
      db.ref("watched_movies").get(),
      db.ref("user_tastes").get(),
      db.ref("follows").get(),
      db.ref("shares").get(),
      db.ref("lists").get(),
      db.ref("list_items").get(),
      db.ref("list_collaborators").get(),
      db.ref("log_comments").get(),
      db.ref("log_likes").get(),
      db.ref("log_saves").get(),
      db.ref("log_comment_likes").get(),
      db.ref("share_replies").get(),
      db.ref("notifications").get(),
    ]);

    const userRecord = userSnapshot.val() as { username?: string } | null;
    const deletedLogIds = new Set<string>();
    const ownedListIds = new Set<string>();
    const deletedShareIds = new Set<string>();
    const updates: Record<string, null> = {
      [`users/${uid}`]: null,
      [`taste_signatures/${uid}`]: null,
      [`watched_movies_meta/${uid}`]: null,
      [`honours/${uid}`]: null,
      [`honour_unlocks/${uid}`]: null,
      [`notifications/${uid}`]: null,
    };

    const username = userRecord?.username?.trim().toLowerCase();
    if (username) {
      const usernameSnapshot = await db.ref(`usernames/${username}`).get();
      if (usernameSnapshot.val() === uid) updates[`usernames/${username}`] = null;
    }

    for (const [id, log] of Object.entries(values<{ user_id?: string }>(logsSnapshot))) {
      if (log?.user_id === uid) {
        deletedLogIds.add(id);
        updates[`movie_logs/${id}`] = null;
      }
    }
    for (const [id, row] of Object.entries(values<{ user_id?: string }>(watchedSnapshot))) {
      if (row?.user_id === uid) updates[`watched_movies/${id}`] = null;
    }
    for (const [id, row] of Object.entries(values<{ user_id?: string }>(tastesSnapshot))) {
      if (row?.user_id === uid) updates[`user_tastes/${id}`] = null;
    }

    for (const [id, follow] of Object.entries(values<{ follower_id?: string; following_id?: string }>(followsSnapshot))) {
      if (follow?.follower_id === uid || follow?.following_id === uid) updates[`follows/${id}`] = null;
    }
    for (const [id, share] of Object.entries(values<{ sender_id?: string; receiver_id?: string }>(sharesSnapshot))) {
      if (share?.sender_id === uid || share?.receiver_id === uid) {
        deletedShareIds.add(id);
        updates[`shares/${id}`] = null;
      }
    }
    for (const [id, list] of Object.entries(values<{ owner_id?: string; collaborator_ids?: Record<string, boolean> }>(listsSnapshot))) {
      if (list?.owner_id === uid) {
        ownedListIds.add(id);
        updates[`lists/${id}`] = null;
      } else if (list?.collaborator_ids?.[uid]) {
        updates[`lists/${id}/collaborator_ids/${uid}`] = null;
      }
    }
    for (const [id, item] of Object.entries(values<{ list_id?: string }>(listItemsSnapshot))) {
      if (item?.list_id && ownedListIds.has(item.list_id)) updates[`list_items/${id}`] = null;
    }
    for (const [id, row] of Object.entries(values<{ list_id?: string; user_id?: string; collaborator_id?: string }>(collaboratorsSnapshot))) {
      if (row?.user_id === uid || row?.collaborator_id === uid || (row?.list_id && ownedListIds.has(row.list_id))) {
        updates[`list_collaborators/${id}`] = null;
      }
    }

    for (const [logId, logComments] of Object.entries(values<Record<string, { user_id?: string }>>(commentsSnapshot))) {
      if (deletedLogIds.has(logId)) {
        updates[`log_comments/${logId}`] = null;
        continue;
      }
      for (const [commentId, comment] of Object.entries(logComments || {})) {
        if (comment?.user_id === uid) updates[`log_comments/${logId}/${commentId}`] = null;
      }
    }
    for (const [logId, row] of Object.entries(values<Record<string, unknown>>(likesSnapshot))) {
      if (row && Object.prototype.hasOwnProperty.call(row, uid)) updates[`log_likes/${logId}/${uid}`] = null;
    }
    for (const [logId, row] of Object.entries(values<Record<string, unknown>>(savesSnapshot))) {
      if (row && Object.prototype.hasOwnProperty.call(row, uid)) updates[`log_saves/${logId}/${uid}`] = null;
    }
    for (const [logId, commentRows] of Object.entries(values<Record<string, Record<string, unknown>>>(commentLikesSnapshot))) {
      for (const [commentId, row] of Object.entries(commentRows || {})) {
        if (row && Object.prototype.hasOwnProperty.call(row, uid)) updates[`log_comment_likes/${logId}/${commentId}/${uid}`] = null;
      }
    }
    for (const [shareId, replies] of Object.entries(values<Record<string, { sender_id?: string }>>(shareRepliesSnapshot))) {
      if (deletedShareIds.has(shareId)) {
        updates[`share_replies/${shareId}`] = null;
        continue;
      }
      for (const [replyId, reply] of Object.entries(replies || {})) {
        if (reply?.sender_id === uid) updates[`share_replies/${shareId}/${replyId}`] = null;
      }
    }
    for (const [recipientId, rows] of Object.entries(values<Record<string, { fromUser?: { id?: string } }>>(notificationsSnapshot))) {
      if (recipientId === uid) continue;
      for (const [notificationId, notification] of Object.entries(rows || {})) {
        if (notification?.fromUser?.id === uid) updates[`notifications/${recipientId}/${notificationId}`] = null;
      }
    }

    await db.ref().update(updates);
    try {
      await getAuth(getFirebaseAdminApp()).deleteUser(uid);
    } catch (error) {
      if ((error as { code?: string })?.code !== "auth/user-not-found") throw error;
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json({ error: "Could not complete account deletion. Please contact support." }, { status: 503 });
  }
}
