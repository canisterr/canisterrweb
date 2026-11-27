import "server-only";

import { unstable_cache } from "next/cache";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import type { Content, MovieLog, UserTaste, UserTasteWithContent, MovieLogWithContent, User } from "@/types";

function fallbackUser(userId: string): User {
  return { id: userId, username: userId, name: "User", avatar_url: null, created_at: new Date().toISOString() };
}

function contentLookup() {
  const inFlight = new Map<string, Promise<Content | null>>();
  return (contentType: "movie" | "tv", contentId: number) => {
    const key = `${contentType}:${contentId}`;
    let result = inFlight.get(key);
    if (!result) {
      result = (contentType === "tv" ? getShowDetails(contentId) : getMovieDetails(contentId))
        .then((content) => content as Content | null);
      inFlight.set(key, result);
    }
    return result;
  };
}

export async function getServerMovieLogs(userId: string): Promise<MovieLogWithContent[]> {
  const snapshot = await getFirebaseAdminDatabase().ref("movie_logs")
    .orderByChild("user_id")
    .equalTo(userId)
    .get();
  if (!snapshot.exists()) return [];

  const logs = Object.values(snapshot.val() as Record<string, MovieLog>)
    .filter((log) => log.user_id === userId && !log.watch_later)
    .sort((left, right) => Date.parse(right.watched_date || right.created_at) - Date.parse(left.watched_date || left.created_at))
    .slice(0, 300);

  const getContent = contentLookup();
  return Promise.all(logs.map(async (log) => {
    const content = await getContent(log.content_type, log.content_id);
    return {
      ...log,
      content: (content || { id: log.content_id, title: "Unknown", poster_url: null, genres: [], actors: [], language: null, release_date: null, overview: null, runtime: null, rating: null, created_at: log.created_at, type: log.content_type }) as Content,
      user: fallbackUser(userId),
    };
  }));
}

export async function getServerTasteProfile(userId: string): Promise<UserTasteWithContent[]> {
  const snapshot = await getFirebaseAdminDatabase().ref("user_tastes")
    .orderByChild("user_id")
    .equalTo(userId)
    .get();
  if (!snapshot.exists()) return [];

  const tastes = Object.values(snapshot.val() as Record<string, UserTaste>)
    .filter((taste) => taste.user_id === userId)
    .sort((left, right) => Date.parse(right.added_at) - Date.parse(left.added_at));

  const getContent = contentLookup();
  return Promise.all(tastes.map(async (taste) => {
    const content = await getContent(taste.content_type, taste.content_id);
    return {
      ...taste,
      content: (content || { id: taste.content_id, title: "Unknown", poster_url: null, genres: [], actors: [], language: null, release_date: null, overview: null, runtime: null, rating: null, created_at: taste.added_at, type: taste.content_type }) as Content,
    };
  }));
}

export const getCachedServerMovieLogs = unstable_cache(getServerMovieLogs, ["movie-dna-logs-v1"], { revalidate: 120 });
export const getCachedServerTasteProfile = unstable_cache(getServerTasteProfile, ["movie-dna-tastes-v1"], { revalidate: 120 });
