"use client";

import { auth } from "@/lib/firebase";
import type { MovieLog, User } from "@/types";

export type ContentActivityLog = MovieLog & {
  user: User;
};

export type ContentActivityPayload = {
  logs: ContentActivityLog[];
  stats: {
    bad: number;
    average: number;
    good: number;
    masterpiece: number;
    total: number;
    totalLogs: number;
    totalWatched: number;
  };
};

export async function fetchContentActivity(
  contentId: number,
  contentType: "movie" | "tv"
): Promise<ContentActivityPayload> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const response = await fetch(`/api/content-activity?contentId=${contentId}&contentType=${contentType}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content activity (${response.status})`);
  }

  return (await response.json()) as ContentActivityPayload;
}
