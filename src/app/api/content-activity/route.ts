import "server-only";

import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import type { MovieLog, MovieReviewWithUser, User } from "@/types";

export const runtime = "nodejs";

type AdminUserRecord = {
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
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

async function getAdminUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const db = getFirebaseAdminDatabase();
  const users = await Promise.all(
    uniqueIds.map(async (userId) => {
      const snapshot = await db.ref(`users/${userId}`).get();
      const raw = snapshot.exists() ? (snapshot.val() as AdminUserRecord) : null;
      return [userId, normalizeAdminUser(userId, raw)] as const;
    })
  );

  return Object.fromEntries(users);
}

function mapReactionToRating(reaction: 0 | 1 | 1.5 | 2 | null | undefined): 1 | 2 | 3 | 4 | 5 {
  if (reaction == null) return 3;
  if (reaction === 2) return 5;
  if (reaction === 1) return 4;
  if (reaction === 1.5) return 3;
  return 2;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contentId = Number(url.searchParams.get("contentId") || 0);
    const contentType = url.searchParams.get("contentType") === "tv" ? "tv" : "movie";

    if (!Number.isFinite(contentId) || contentId <= 0) {
      return NextResponse.json(
        {
          logs: [],
          reviews: [],
          stats: {
            bad: 0,
            average: 0,
            good: 0,
            masterpiece: 0,
            total: 0,
            totalLogs: 0,
            totalWatched: 0,
          },
        },
        { status: 200 }
      );
    }

    const db = getFirebaseAdminDatabase();
    const logsSnapshot = await db.ref("movie_logs").get();

    if (!logsSnapshot.exists()) {
      return NextResponse.json(
        {
          logs: [],
          reviews: [],
          stats: {
            bad: 0,
            average: 0,
            good: 0,
            masterpiece: 0,
            total: 0,
            totalLogs: 0,
            totalWatched: 0,
          },
        },
        { status: 200 }
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

    const usersById = await getAdminUsersByIds(contentLogs.map((log) => log.user_id));
    const logs = contentLogs.map((log) => ({
      ...log,
      user: usersById[log.user_id] || createFallbackUser(log.user_id),
    }));

    const reviews: MovieReviewWithUser[] = contentLogs
      .filter((log) => typeof log.notes === "string" && log.notes.trim().length > 0)
      .map((log) => ({
        id: `log-${log.id}`,
        user_id: log.user_id,
        content_id: contentId,
        content_type: contentType,
        rating: mapReactionToRating(log.reaction),
        text: log.notes,
        likes_count: 0,
        created_at: log.created_at || new Date().toISOString(),
        updated_at: log.updated_at || log.created_at || new Date().toISOString(),
        user: usersById[log.user_id] || createFallbackUser(log.user_id),
      }));

    const bad = contentLogs.filter((log) => log.reaction === 0).length;
    const average = contentLogs.filter((log) => log.reaction === 1.5).length;
    const good = contentLogs.filter((log) => log.reaction === 1).length;
    const masterpiece = contentLogs.filter((log) => log.reaction === 2).length;
    const total = bad + average + good + masterpiece;
    const totalLogs = contentLogs.length;
    const totalWatched = new Set(contentLogs.map((log) => log.user_id)).size;

    return NextResponse.json({
      logs,
      reviews,
      stats: {
        bad,
        average,
        good,
        masterpiece,
        total,
        totalLogs,
        totalWatched,
      },
    });
  } catch (error) {
    console.error("Failed to load content activity:", error);
    return NextResponse.json(
      {
        logs: [],
        reviews: [],
        stats: {
          bad: 0,
          average: 0,
          good: 0,
          masterpiece: 0,
          total: 0,
          totalLogs: 0,
          totalWatched: 0,
        },
      },
      { status: 200 }
    );
  }
}
