import "server-only";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import type { MovieLog, User } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminUserRecord = {
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
  settings?: {
    privacy?: { logVisibility?: "public" | "followers" | "private" };
    social?: { blockedUsers?: string[] };
  };
};

function createFallbackUser(userId: string): User {
  return {
    id: userId,
    username: userId,
    name: "User",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeAdminUser(userId: string, raw: AdminUserRecord | null | undefined): User {
  if (!raw) return createFallbackUser(userId);

  return {
    id: userId,
    username: raw.username || userId,
    name: raw.name || raw.username || "User",
    avatar_url: raw.avatar_url || null,
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

async function getViewerId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  try {
    return (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

const emptyStats = {
  bad: 0,
  average: 0,
  good: 0,
  masterpiece: 0,
  total: 0,
  totalLogs: 0,
  totalWatched: 0,
};

async function getAdminUserRecordsByIds(userIds: string[]): Promise<Record<string, AdminUserRecord>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const db = getFirebaseAdminDatabase();
  const users = await Promise.all(
    uniqueIds.map(async (userId) => {
      const snapshot = await db.ref(`users/${userId}`).get();
      const raw = snapshot.exists() ? (snapshot.val() as AdminUserRecord) : null;
      return [userId, raw || {}] as const;
    })
  );

  return Object.fromEntries(users);
}

export async function GET(request: Request) {
  try {
    const viewerId = await getViewerId(request);
    const url = new URL(request.url);
    const contentId = Number(url.searchParams.get("contentId") || 0);
    const contentType = url.searchParams.get("contentType") === "tv" ? "tv" : "movie";

    if (!Number.isFinite(contentId) || contentId <= 0) {
      return NextResponse.json(
        {
          logs: [],
          stats: emptyStats,
        },
        { status: 200, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const db = getFirebaseAdminDatabase();
    const logsSnapshot = await db.ref("movie_logs")
      .orderByChild("content_id")
      .equalTo(contentId)
      .get();

    if (!logsSnapshot.exists()) {
      return NextResponse.json(
        {
          logs: [],
          stats: emptyStats,
        },
        { status: 200, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const allLogs = Object.values(logsSnapshot.val() as Record<string, MovieLog>);
    const contentLogs = allLogs
      .filter(
        (log) =>
          log.content_type === contentType &&
          Number(log.content_id) === contentId &&
          !log.watch_later &&
          Boolean(log.watched_date)
      )
      .sort((a, b) => {
        const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
        if (watchedDiff !== 0) return watchedDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    const userRecords = await getAdminUserRecordsByIds([
      ...contentLogs.map((log) => log.user_id),
      ...(viewerId ? [viewerId] : []),
    ]);
    const followsSnapshot = viewerId
      ? await db.ref("follows").orderByChild("follower_id").equalTo(viewerId).get()
      : null;
    const followedIds = new Set<string>();
    if (followsSnapshot?.exists()) {
      Object.values(followsSnapshot.val() as Record<string, { follower_id?: string; following_id?: string; status?: string }>).forEach((follow) => {
        if (follow.follower_id === viewerId && follow.status === "accepted" && follow.following_id) {
          followedIds.add(follow.following_id);
        }
      });
    }

    const viewerUsername = userRecords[viewerId || ""]?.username?.trim().toLowerCase();
    const isBlockedEitherWay = (ownerId: string) => {
      if (!viewerId || ownerId === viewerId) return false;
      const owner = userRecords[ownerId];
      const ownerUsername = owner?.username?.trim().toLowerCase();
      const viewerBlocksOwner = userRecords[viewerId]?.settings?.social?.blockedUsers || [];
      const ownerBlocksViewer = owner?.settings?.social?.blockedUsers || [];
      return Boolean(
        (ownerUsername && viewerBlocksOwner.some((name) => name.trim().toLowerCase() === ownerUsername)) ||
        (viewerUsername && ownerBlocksViewer.some((name) => name.trim().toLowerCase() === viewerUsername))
      );
    };
    const visibilityFor = (ownerId: string) => userRecords[ownerId]?.settings?.privacy?.logVisibility || "public";
    const canReadLog = (log: MovieLog) => {
      if (!viewerId) return false;
      if (log.user_id === viewerId) return true;
      if (isBlockedEitherWay(log.user_id) || !followedIds.has(log.user_id)) return false;
      return visibilityFor(log.user_id) !== "private";
    };
    // Anonymous visitors can see only aggregate counts from public logs. Named
    // logs are returned only to the owner or an accepted follower, and only when
    // the owner has not made logs private or blocked that viewer.
    const aggregateLogs = contentLogs.filter((log) => {
      const visibility = visibilityFor(log.user_id);
      if (visibility === "private") return log.user_id === viewerId;
      if (visibility === "followers") return log.user_id === viewerId || Boolean(viewerId && followedIds.has(log.user_id));
      return true;
    });
    const visibleLogs = viewerId
      ? contentLogs.filter(canReadLog)
      : [];
    const logs = visibleLogs.map((log) => ({
      ...log,
      user: normalizeAdminUser(log.user_id, userRecords[log.user_id]),
    }));

    const bad = aggregateLogs.filter((log) => log.reaction === 0).length;
    const average = aggregateLogs.filter((log) => log.reaction === 1.5).length;
    const good = aggregateLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = aggregateLogs.filter((log) => log.reaction === 2).length;
    const total = bad + average + good + masterpiece;
    const totalLogs = aggregateLogs.length;
    const totalWatched = new Set(aggregateLogs.map((log) => log.user_id)).size;

    return NextResponse.json({
      logs,
      stats: {
        bad,
        average,
        good,
        masterpiece,
        total,
        totalLogs,
        totalWatched,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Failed to load content activity:", error);
    return NextResponse.json(
      {
        logs: [],
        stats: emptyStats,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
