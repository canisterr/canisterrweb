import "server-only";

import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function records(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function getUid(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return Promise.resolve(null);
  return getAuth(getFirebaseAdminApp()).verifyIdToken(token, true).then((decoded) => decoded.uid).catch(() => null);
}

export async function GET(request: Request) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: "Sign in to download your data." }, { status: 401 });

  try {
    const db = getFirebaseAdminDatabase();
    const [authUser, user, logs, watched, tastes, signature, follows, shares, lists, listItems,
      collaborators, comments, likes, saves, commentLikes, shareReplies, notifications] = await Promise.all([
      getAuth(getFirebaseAdminApp()).getUser(uid),
      db.ref(`users/${uid}`).get(),
      db.ref("movie_logs").orderByChild("user_id").equalTo(uid).get(),
      db.ref("watched_movies").orderByChild("user_id").equalTo(uid).get(),
      db.ref("user_tastes").orderByChild("user_id").equalTo(uid).get(),
      db.ref(`taste_signatures/${uid}`).get(),
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
      db.ref(`notifications/${uid}`).get(),
    ]);

    const ownedLists = Object.fromEntries(Object.entries(records(lists.val())).filter(([, row]) => row?.owner_id === uid));
    const ownedListIds = new Set(Object.keys(ownedLists));
    const ownLogs = records(logs.val());
    const ownShares = Object.fromEntries(Object.entries(records(shares.val())).filter(([, row]) => row?.sender_id === uid || row?.receiver_id === uid));
    const shareIds = new Set(Object.keys(ownShares));
    const ownComments: Record<string, Record<string, unknown>> = {};
    for (const [logId, rows] of Object.entries(records(comments.val()))) {
      const matches = Object.fromEntries(Object.entries(records(rows)).filter(([, row]) => row?.user_id === uid));
      if (Object.keys(matches).length) ownComments[logId] = matches;
    }
    const ownLikes: Record<string, unknown> = {};
    const ownSaves: Record<string, unknown> = {};
    const ownCommentLikes: Record<string, Record<string, unknown>> = {};
    for (const [logId, rows] of Object.entries(records(likes.val()))) if (records(rows)[uid] !== undefined) ownLikes[logId] = records(rows)[uid];
    for (const [logId, rows] of Object.entries(records(saves.val()))) if (records(rows)[uid] !== undefined) ownSaves[logId] = records(rows)[uid];
    for (const [logId, commentsForLog] of Object.entries(records(commentLikes.val()))) {
      for (const [commentId, rows] of Object.entries(records(commentsForLog))) {
        if (records(rows)[uid] !== undefined) {
          ownCommentLikes[logId] ||= {};
          ownCommentLikes[logId][commentId] = records(rows)[uid];
        }
      }
    }
    const exported = {
      exported_at: new Date().toISOString(),
      account: { id: uid, email: authUser.email || null, ...records(user.val()) },
      movie_logs: ownLogs,
      watched_movies: records(watched.val()),
      tastes: records(tastes.val()),
      taste_signature: signature.val(),
      follows: Object.fromEntries(Object.entries(records(follows.val())).filter(([, row]) => row?.follower_id === uid || row?.following_id === uid)),
      shares: ownShares,
      share_replies: Object.fromEntries(Object.entries(records(shareReplies.val())).filter(([shareId, replies]) =>
        shareIds.has(shareId) || Object.values(records(replies)).some((reply) => reply?.sender_id === uid)
      )),
      lists: ownedLists,
      list_items: Object.fromEntries(Object.entries(records(listItems.val())).filter(([, row]) => ownedListIds.has(row?.list_id))),
      list_collaborations: Object.fromEntries(Object.entries(records(collaborators.val())).filter(([, row]) => row?.user_id === uid || row?.collaborator_id === uid || ownedListIds.has(row?.list_id))),
      comments: ownComments,
      likes: ownLikes,
      saves: ownSaves,
      comment_likes: ownCommentLikes,
      notifications: records(notifications.val()),
      note: "This export includes Canisterr records currently associated with this account. It does not include provider-side records held by Firebase, hosting, or media-data providers.",
    };

    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="canisterr-data-${uid}.json"`,
      },
    });
  } catch (error) {
    console.error("Account data export failed:", error);
    return NextResponse.json({ error: "Could not prepare your data export." }, { status: 503 });
  }
}
