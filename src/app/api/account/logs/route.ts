import "server-only";

import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFrom(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export async function DELETE(request: Request) {
  const token = tokenFrom(request);
  if (!token) return NextResponse.json({ error: "Sign in again to delete your logs." }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAuth(getFirebaseAdminApp()).verifyIdToken(token, true)).uid;
  } catch {
    return NextResponse.json({ error: "Your session expired. Sign in again and retry." }, { status: 401 });
  }

  try {
    const db = getFirebaseAdminDatabase();
    const logsSnapshot = await db.ref("movie_logs").orderByChild("user_id").equalTo(uid).get();
    const ownedLogs = logsSnapshot.val() as Record<string, { user_id?: string }> | null;
    const logIds = Object.entries(ownedLogs || {})
      .filter(([, log]) => log?.user_id === uid)
      .map(([id]) => id);

    // Keep each update small while removing the log and all activity nested under it.
    for (let offset = 0; offset < logIds.length; offset += 200) {
      const updates: Record<string, null> = {};
      for (const logId of logIds.slice(offset, offset + 200)) {
        updates[`movie_logs/${logId}`] = null;
        updates[`log_comments/${logId}`] = null;
        updates[`log_likes/${logId}`] = null;
        updates[`log_saves/${logId}`] = null;
        updates[`log_comment_likes/${logId}`] = null;
      }
      await db.ref().update(updates);
    }

    return NextResponse.json(
      { ok: true, deletedCount: logIds.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Log deletion failed:", error);
    return NextResponse.json({ error: "Could not delete your logs. Please try again." }, { status: 503 });
  }
}
