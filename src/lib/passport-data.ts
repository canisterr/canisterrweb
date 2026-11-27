import { get, ref } from "firebase/database";
import type { Movie, MovieLog, MovieLogWithContent, User } from "@/types";
import { db } from "./firebase";
import { getLogsForUser, getVisibleLogNotes } from "./logs";
import { readBrowserCacheEntry } from "./browser-cache";
import { getMovieDetails } from "./tmdb";

type PassportMovieDetails = Partial<Movie>;

function hasOrigin(details?: PassportMovieDetails | null) {
  return Boolean(details?.origin_countries?.length || details?.production_companies?.length ||
    details?.production_countries?.length || details?.countries?.length || details?.country);
}

function movieFromDetails(log: MovieLog, details?: PassportMovieDetails | null): Movie {
  return {
    id: log.content_id,
    genres: details?.genres || [],
    platforms: [],
    director: null,
    release_date: details?.release_date || null,
    overview: null,
    runtime: details?.runtime || null,
    rating: null,
    created_at: log.created_at,
    type: "movie",
    ...details,
    title: log.content_summary?.title || log.title_snapshot || details?.title || "Unknown Movie",
    poster_url: log.content_summary?.poster_url || log.poster_url_snapshot || details?.poster_url || null,
  };
}

/** One logs read and one shared metadata read; only unresolved films need TMDB. */
export async function getPassportLogs(user: User): Promise<MovieLogWithContent[]> {
  const allLogs = await getLogsForUser(user.id);
  const watched = allLogs.filter((log) => log.content_type === "movie" && !log.watch_later && log.watched_date);
  if (!watched.length) return [];

  let shared: Record<string, PassportMovieDetails> = {};
  try {
    const snapshot = await get(ref(db, `watched_movies_meta/${user.id}/story_details`));
    shared = snapshot.val() || {};
  } catch {
    // The browser detail cache and TMDB can still supply origin data.
  }

  const unique = [...new Set(watched.map((log) => log.content_id))];
  const details = new Map<number, PassportMovieDetails>();
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (cursor < unique.length) {
      const id = unique[cursor++];
      const cached = readBrowserCacheEntry<PassportMovieDetails>(`tmdb:movie-details:v1:${id}`)?.value;
      const available = cached || shared[`movie_${id}`];
      details.set(id, hasOrigin(available) ? available! : (await getMovieDetails(id)) || available || {});
    }
  }));

  return watched.map((log) => ({
    ...log,
    notes: getVisibleLogNotes(log),
    content: movieFromDetails(log, details.get(log.content_id)),
    user,
  }));
}
