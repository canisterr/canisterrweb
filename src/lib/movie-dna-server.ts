import "server-only";

import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import type { Content, MovieLog, UserTaste, UserTasteWithContent, MovieLogWithContent, User } from "@/types";

function fallbackUser(userId: string): User {
  return { id: userId, username: userId, name: "User", avatar_url: null, created_at: new Date().toISOString() };
}

export async function getServerMovieLogs(userId: string): Promise<MovieLogWithContent[]> {
  const snapshot = await getFirebaseAdminDatabase().ref("movie_logs").get();
  if (!snapshot.exists()) return [];

  const logs = Object.values(snapshot.val() as Record<string, MovieLog>)
    .filter((log) => log.user_id === userId && !log.watch_later)
    .sort((left, right) => Date.parse(right.watched_date || right.created_at) - Date.parse(left.watched_date || left.created_at))
    .slice(0, 300);

  return Promise.all(logs.map(async (log) => {
    const content = log.content_type === "tv"
      ? await getShowDetails(log.content_id)
      : await getMovieDetails(log.content_id);
    return {
      ...log,
      content: (content || { id: log.content_id, title: "Unknown", poster_url: null, genres: [], actors: [], language: null, release_date: null, overview: null, runtime: null, rating: null, created_at: log.created_at, type: log.content_type }) as Content,
      user: fallbackUser(userId),
    };
  }));
}

export async function getServerTasteProfile(userId: string): Promise<UserTasteWithContent[]> {
  const snapshot = await getFirebaseAdminDatabase().ref("user_tastes").get();
  if (!snapshot.exists()) return [];

  const tastes = Object.values(snapshot.val() as Record<string, UserTaste>)
    .filter((taste) => taste.user_id === userId)
    .sort((left, right) => Date.parse(right.added_at) - Date.parse(left.added_at));

  return Promise.all(tastes.map(async (taste) => {
    const content = taste.content_type === "tv"
      ? await getShowDetails(taste.content_id)
      : await getMovieDetails(taste.content_id);
    return {
      ...taste,
      content: (content || { id: taste.content_id, title: "Unknown", poster_url: null, genres: [], actors: [], language: null, release_date: null, overview: null, runtime: null, rating: null, created_at: taste.added_at, type: taste.content_type }) as Content,
    };
  }));
}