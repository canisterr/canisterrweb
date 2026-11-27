import { db } from "@/lib/firebase";
import { equalTo, get, orderByChild, query, ref } from "firebase/database";
import { Content, MovieLog, MovieLogWithContent, User } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { getLogsForUser, getVisibleLogNotes } from "./logs";
import { getAllUsersCached, getDisplayUserName, getUsersByIds } from "./users";
import { getTmdbPosterUrl } from "./performance";
import { lsGet, lsSet } from "./local-cache";

const FRIEND_LOG_SUMMARY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type LogContentSummary = { title: string; poster_url: string | null };
const summaryInFlight = new Map<string, Promise<Content>>();

async function loadContentSummaryForLog(log: MovieLog): Promise<Content> {
  if (log.content_summary?.title) {
    return { ...createFallbackContentForLog(log), ...log.content_summary } as Content;
  }
  if (log.title_snapshot) {
    return {
      ...createFallbackContentForLog(log),
      title: log.title_snapshot,
      poster_url: log.poster_url_snapshot || null,
    } as Content;
  }
  const cacheKey = `friend_log_summary_v1_${log.content_type}_${log.content_id}`;
  const cached = lsGet<LogContentSummary>(cacheKey, FRIEND_LOG_SUMMARY_TTL_MS);
  if (cached?.title) {
    return { ...createFallbackContentForLog(log), ...cached } as Content;
  }

  if (log.content_type === "movie") {
    try {
      const snapshot = await get(ref(db, `movies/${log.content_id}`));
      if (snapshot.exists()) {
        const movie = snapshot.val() as { title?: string; poster_path?: string | null; poster_url?: string | null };
        if (movie.title) {
          const summary = {
            title: movie.title,
            poster_url: getTmdbPosterUrl(movie.poster_url || movie.poster_path, "w500"),
          };
          lsSet(cacheKey, summary, FRIEND_LOG_SUMMARY_TTL_MS);
          return { ...createFallbackContentForLog(log), ...summary } as Content;
        }
      }
    } catch {
      // The movie catalog is optional; fall through to the detail provider.
    }
  }

  const content = log.content_type === "tv"
    ? await getShowDetails(log.content_id)
    : await getMovieDetails(log.content_id);
  const title = content && ("title" in content ? content.title : content.name);
  if (!title) return createFallbackContentForLog(log);

  const summary = { title, poster_url: content.poster_url || null };
  lsSet(cacheKey, summary, FRIEND_LOG_SUMMARY_TTL_MS);
  return { ...createFallbackContentForLog(log), ...summary } as Content;
}

function getContentSummaryForLog(log: MovieLog): Promise<Content> {
  const key = `${log.content_type}:${log.content_id}`;
  const existing = summaryInFlight.get(key);
  if (existing) return existing;

  const request = loadContentSummaryForLog(log).finally(() => summaryInFlight.delete(key));
  summaryInFlight.set(key, request);
  return request;
}

function createFallbackContentForLog(log: MovieLog): Content {
  if (log.content_type === "tv") {
    return {
      id: log.content_id,
      title: log.title_snapshot || "Unknown Show",
      name: log.title_snapshot || "Unknown Show",
      poster_url: log.poster_url_snapshot || null,
      genres: [],
      actors: [],
      language: null,
      status: null,
      release_date: null,
      overview: "Show details are unavailable right now.",
      runtime: null,
      rating: null,
      created_at: new Date().toISOString(),
      type: "tv",
    };
  }

  return {
    id: log.content_id,
    title: log.title_snapshot || "Unknown Movie",
    poster_url: log.poster_url_snapshot || null,
    backdrop_url: null,
    genres: [],
    platforms: [],
    director: null,
    actors: [],
    language: null,
    release_date: null,
    overview: "Movie details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

/**
 * Get logs from users that current user is following (last 14 days)
 */
type GetFriendLogsOptions = {
  daysBack?: number | null;
  limit?: number | null;
  dedupeByContent?: boolean;
  summaryOnly?: boolean;
  onFollowingCount?: (count: number) => void;
};

export async function getFriendLogs(
  userId: string,
  daysBackOrOptions: number | GetFriendLogsOptions | null = 14,
  limit: number = 50
): Promise<(MovieLogWithContent & { friend: User })[]> {
  try {
    const options: GetFriendLogsOptions =
      typeof daysBackOrOptions === "object" && daysBackOrOptions !== null
        ? daysBackOrOptions
        : {
            daysBack: daysBackOrOptions,
            limit,
          };
    const daysBack = typeof options.daysBack === "number" ? options.daysBack : null;
    const maxItems = typeof options.limit === "number" ? options.limit : null;
    const dedupeByContent = options.dedupeByContent !== false;
    const summaryOnly = options.summaryOnly === true;

    // 1. Get list of users that current user is following
    const followSnapshot = await get(
      query(ref(db, "follows"), orderByChild("follower_id"), equalTo(userId))
    );

    if (!followSnapshot.exists()) {
      options.onFollowingCount?.(0);
      return [];
    }

    const allFollows = followSnapshot.val();
    const followingIds = Object.values(allFollows)
      .filter((follow: any) => follow.follower_id === userId && follow.status === "accepted")
      .map((follow: any) => follow.following_id);
    options.onFollowingCount?.(followingIds.length);

    if (followingIds.length === 0) {
      return [];
    }

    // Watchlist records are stored in movie_logs with watch_later=true.
    // Reading all watched_movies markers here is unnecessary and can make
    // the entire feed fail during a fresh authentication session.
    const friendLogsByUser = await Promise.all(
      followingIds.map((followingId) => getLogsForUser(followingId))
    );

    // 3. Filter logs from following users created in last X days
    const dateThreshold =
      typeof daysBack === "number" && Number.isFinite(daysBack)
        ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        : null;

    const allLogs = friendLogsByUser.flat();
    const filteredLogs = allLogs
      .filter((log: any) => {
        const logDate = new Date(log.created_at);
        if (!followingIds.includes(log.user_id) || log.watch_later || !log.watched_date) {
          return false;
        }
        if (!dateThreshold) {
          return true;
        }
        return logDate >= dateThreshold;
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const dedupedLogs = dedupeByContent
      ? filteredLogs.reduce((acc: any[], log: any) => {
          const key = `${log.user_id}__${log.content_type}__${log.content_id}`;
          if (acc.some((item) => `${item.user_id}__${item.content_type}__${item.content_id}` === key)) {
            return acc;
          }
          acc.push(log);
          return acc;
        }, [])
      : filteredLogs;

    const friendLogs =
      typeof maxItems === "number" && Number.isFinite(maxItems)
        ? dedupedLogs.slice(0, maxItems)
        : dedupedLogs;

    const logsWithContent = await Promise.all(
      friendLogs.map(async (log: any) => {
        try {
          // Fetch content
          let content: Content | null;
          if (summaryOnly) {
            content = await getContentSummaryForLog(log);
          } else if (log.content_type === "tv") {
            content = (await getShowDetails(log.content_id)) as unknown as Content | null;
          } else {
            content = (await getMovieDetails(log.content_id)) as unknown as Content | null;
          }

          return {
            ...log,
            notes: getVisibleLogNotes(log),
            content: content || createFallbackContentForLog(log),
          };
        } catch (error) {
          console.error(`Error fetching details for log ${log.id}:`, error);
          return {
            ...log,
            notes: getVisibleLogNotes(log),
            content: createFallbackContentForLog(log),
          };
        }
      })
    );

    const availableLogs = logsWithContent.filter((log) => log !== null);
    const friendUsers = await getUsersByIds(availableLogs.map((log) => log.user_id));
    const unresolvedIds = new Set(
      availableLogs
        .map((log) => log.user_id)
        .filter((id) => !friendUsers[id] || getDisplayUserName(friendUsers[id]) === "User")
    );

    // A direct profile read can briefly return no record. Retry those identities
    // through the shared users snapshot; this read only happens when needed.
    if (unresolvedIds.size > 0) {
      const allUsers = await getAllUsersCached();
      for (const id of unresolvedIds) {
        const recovered = allUsers[id];
        if (recovered && getDisplayUserName(recovered) !== "User") {
          friendUsers[id] = recovered;
        }
      }
    }

    return availableLogs.flatMap((log) => {
      const friend = friendUsers[log.user_id];
      if (!friend || getDisplayUserName(friend) === "User") return [];
      return [{ ...log, user: friend, friend }];
    }) as (MovieLogWithContent & { friend: User })[];
  } catch (error) {
    console.error("Error fetching friend logs:", error);
    throw error;
  }
}
