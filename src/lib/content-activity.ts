"use client";

import type { MovieLog, MovieReviewWithUser, User } from "@/types";

export type ContentActivityLog = MovieLog & {
  user: User;
};

export type ContentActivityPayload = {
  logs: ContentActivityLog[];
  reviews: MovieReviewWithUser[];
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
  const response = await fetch(`/api/content-activity?contentId=${contentId}&contentType=${contentType}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content activity (${response.status})`);
  }

  return (await response.json()) as ContentActivityPayload;
}
