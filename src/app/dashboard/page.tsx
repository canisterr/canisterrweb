"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "@/components/AppImage";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import OnThisDay from "@/components/home/OnThisDay";
import ReleaseDay from "@/components/home/ReleaseDay";
import AdminFeaturedLists from "@/components/home/AdminFeaturedLists";
import HomeGamesStrip from "@/components/home/HomeGamesStrip";
import HomeStatsBento from "@/components/home/HomeStatsBento";
import NewUserGuide from "@/components/home/NewUserGuide";
import ExploreLists from "@/components/home/ExploreLists";
import { User, Content, MovieLog, MovieLogWithContent, TMDBPersonSearchResult } from "@/types";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMulti } from "@/lib/search-multi";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getFriendLogs } from "@/lib/friend-logs";
import { auth } from "@/lib/firebase";
import { isPermissionDeniedError } from "@/lib/firebase-errors";
import { getLogsForUser } from "@/lib/logs";
import { reportAppError } from "@/lib/report-error";
import { getDisplayUserName, searchUsersCached } from "@/lib/users";
import { getBlurDataUrl } from "@/lib/performance";
import { getTmdbPosterUrl } from "@/lib/performance";
import { buildCrewPath, getCrewKnownWorks } from "@/lib/crew";
import Link from "next/link";
import { ArrowRight, Clock, Film, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";

const SEARCH_HISTORY_STORAGE_KEY = "cine_search_history";
const MAX_SEARCH_HISTORY = 8;

const LogMovieModal = dynamic(() => import("@/components/LogMovieModal"), { ssr: false });
type SearchAccount = {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
};

type SearchCrewResult = TMDBPersonSearchResult & {
  resultType: "crew";
};

type GlobalSearchResult = Content | SearchCrewResult;

function dedupeAccountResults(items: SearchAccount[]): SearchAccount[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.id || normalizeAccountSearchText(item.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isCrewSearchResult(result: GlobalSearchResult): result is SearchCrewResult {
  return "resultType" in result && result.resultType === "crew";
}

function isContentSearchResult(result: GlobalSearchResult): result is Content {
  return !isCrewSearchResult(result);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAccountSearchText(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function getActivityTimestamp(value: unknown): number {
  if (typeof value === "number") {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    return Number.isFinite(milliseconds) ? milliseconds : 0;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

function rankSearchResults<T extends { title: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;

  return [...items].sort((a, b) => {
    const score = (item: T) => {
      const title = normalizeSearchText(item.title || "");
      let value = 0;

      if (title === normalizedQuery) value += 120;
      if (title.startsWith(normalizedQuery)) value += 80;
      if (title.includes(normalizedQuery)) value += 50;

      return value;
    };

    return score(b) - score(a);
  });
}

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(entries: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage failures
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [friendLogs, setFriendLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [friendActivityStatus, setFriendActivityStatus] = useState<"loading" | "ready" | "error">("loading");
  const [friendActivityRetry, setFriendActivityRetry] = useState(0);
  const [showNewUserPreview, setShowNewUserPreview] = useState(false);
  const [ownLogs, setOwnLogs] = useState<MovieLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [accountResults, setAccountResults] = useState<SearchAccount[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "tv" | "crew" | "accounts">("all");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [showQuickLogSearch, setShowQuickLogSearch] = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogContent, setQuickLogContent] = useState<Content | null>(null);
  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [quickLogResults, setQuickLogResults] = useState<Content[]>([]);
  const [quickLogSearching, setQuickLogSearching] = useState(false);
  const [quickLogFilter, setQuickLogFilter] = useState<"all" | "movie" | "tv">("all");
  const [searchTimerRef] = useState<{ current: ReturnType<typeof setTimeout> | null }>({ current: null });
  const [searchRequestRef] = useState<{ current: number }>({ current: 0 });
  const [quickLogTimerRef] = useState<{ current: ReturnType<typeof setTimeout> | null }>({ current: null });
  const [quickLogRequestRef] = useState<{ current: number }>({ current: 0 });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) {
      setUser(null);
      setLoading(false);
      setFriendLogs([]);
      setFriendActivityStatus("ready");
      setOwnLogs(null);
      return;
    }

    const currentUser = sessionUser;
    setUser(currentUser);
    setLoading(false);
  }, [router, sessionLoading, sessionUser]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    setShowNewUserPreview(new URLSearchParams(window.location.search).get("newUserPreview") === "1");
  }, []);

  useEffect(() => {
    if (sessionLoading || !sessionUser?.id) return;

    let cancelled = false;
    setOwnLogs(null);
    void getLogsForUser(sessionUser.id)
      .then((logs) => {
        if (!cancelled) setOwnLogs(logs);
      })
      .catch((error) => {
        console.error("Could not load home stats:", error);
        if (!cancelled) setOwnLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, sessionUser?.id]);

  useEffect(() => {
    if (sessionLoading || !sessionUser?.id) return;

    let cancelled = false;
    const userId = sessionUser.id;
    const options = { daysBack: null, limit: 8, dedupeByContent: false, summaryOnly: true };
    setFollowingCount(null);
    setFriendActivityStatus("loading");

    void (async () => {
      try {
        let logs;
        try {
          logs = await getFriendLogs(userId, { ...options, onFollowingCount: setFollowingCount });
        } catch (error) {
          if (!isPermissionDeniedError(error) || auth.currentUser?.uid !== userId) throw error;
          await auth.currentUser.getIdToken(true);
          if (cancelled) return;
          logs = await getFriendLogs(userId, { ...options, onFollowingCount: setFollowingCount });
        }
        if (cancelled) return;
        setFriendLogs(logs);
        setFriendActivityStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setFriendActivityStatus("error");
        reportAppError({
          title: "Friend activity failed",
          message: "We could not load your friends' logs.",
          details: error instanceof Error ? error.stack || error.message : String(error),
        });
      }
    })();

    return () => { cancelled = true; };
  }, [sessionLoading, sessionUser?.id, friendActivityRetry]);

  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  useEffect(() => {
    saveSearchHistory(searchHistory);
  }, [searchHistory]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      if (quickLogTimerRef.current) {
        clearTimeout(quickLogTimerRef.current);
      }
    };
  }, []);

  const rememberSearch = (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length < 2) return;

    setSearchHistory((current) => {
      const next = [cleaned, ...current.filter((entry) => entry.toLowerCase() !== cleaned.toLowerCase())];
      return next.slice(0, MAX_SEARCH_HISTORY);
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  const removeSearchHistoryItem = (item: string) => {
    setSearchHistory((current) => current.filter((entry) => entry !== item));
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setAccountResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const [media, usersData] = await Promise.all([
          searchMulti(query),
          searchUsersCached(query),
        ]);
        const { movies, shows, people } = media;

        if (requestId !== searchRequestRef.current) return;

        const movieResults = movies.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          poster_url: getTmdbPosterUrl(movie.poster_path, "w500"),
          genres: movie.genres || [],
          release_date: movie.release_date || "",
          overview: movie.overview || "",
          runtime: movie.runtime || 0,
          rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
          type: "movie" as const,
          platforms: [],
          director: movie.director || null,
          language: movie.original_language || movie.language || null,
          created_at: new Date().toISOString(),
        }));

        const showResults = shows.map((show: any) => ({
          id: show.id,
          title: show.name || show.title,
          name: show.name,
          poster_url: show.poster_url,
          genres: show.genres || [],
          release_date: show.release_date || "",
          overview: show.overview || "",
          runtime: show.runtime || 0,
          rating: typeof show.rating === "number" ? show.rating : 0,
          type: "tv" as const,
          status: show.status,
          network: show.network || undefined,
          language: show.language || show.original_language || null,
          source: show.source,
          tmdb_id: show.tmdb_id,
          tvmaze_id: show.tvmaze_id,
          created_at: new Date().toISOString(),
        }));

        const combinedContent = rankSearchResults(
          [...movieResults.slice(0, 12), ...showResults.slice(0, 12)],
          query
        ).slice(0, 20);
        const crewResults: SearchCrewResult[] = people.slice(0, 10).map((person) => ({
          ...person,
          resultType: "crew" as const,
        }));

        setSearchResults([...combinedContent, ...crewResults]);

        const normalizedQuery = normalizeAccountSearchText(query);
        const usersMatched = dedupeAccountResults(
          Object.values(usersData)
          .filter((entry: any) => {
            const username = normalizeAccountSearchText(String(entry?.username || ""));
            const name = normalizeAccountSearchText(String(entry?.name || ""));
            return username.includes(normalizedQuery) || name.includes(normalizedQuery);
          })
          .slice(0, 20)
          .map((entry: any) => ({
            id: entry?.id || "",
            username: entry?.username || "",
            name: entry?.name || "User",
            avatar_url: entry?.avatar_url || null,
          }))
          .filter((entry: SearchAccount) => entry.username)
        );

        setAccountResults(usersMatched);
        setShowSearchModal(true);
        rememberSearch(query);
      } catch (error) {
        reportAppError({
          title: "Search failed",
          message: "We could not complete the search.",
          details: error instanceof Error ? error.stack || error.message : String(error),
        });
      } finally {
        if (requestId === searchRequestRef.current) {
          setSearching(false);
        }
      }
    }, query.trim().length === 1 ? 700 : 450);
  };

  const openAccountSearch = () => {
    setSearchFilter("accounts");
    setSearchQuery("");
    setSearchResults([]);
    setAccountResults([]);
    setShowSearchModal(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleQuickLogSearch = (queryText: string) => {
    setQuickLogQuery(queryText);
    const requestId = quickLogRequestRef.current + 1;
    quickLogRequestRef.current = requestId;

    if (quickLogTimerRef.current) {
      clearTimeout(quickLogTimerRef.current);
    }

    if (!queryText.trim()) {
      setQuickLogResults([]);
      setQuickLogSearching(false);
      return;
    }

    setQuickLogSearching(true);
    quickLogTimerRef.current = setTimeout(async () => {
      try {
        const media = await searchMulti(queryText);
        const movies = quickLogFilter === "tv" ? [] : media.movies;
        const shows = quickLogFilter === "movie" ? [] : media.shows;

        if (requestId !== quickLogRequestRef.current) return;

        const movieResults = movies.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          poster_url: getTmdbPosterUrl(movie.poster_path, "w500"),
          genres: (movie.genres || []).map((genreId: number) => String(genreId)),
          release_date: movie.release_date || "",
          overview: movie.overview || "",
          runtime: movie.runtime || 0,
          rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
          type: "movie" as const,
          platforms: [],
          director: movie.director || null,
          language: movie.original_language || movie.language || null,
          created_at: new Date().toISOString(),
        }));

        const showResults = shows.map((show: any) => ({
          id: show.id,
          title: show.name || show.title || "",
          name: show.name,
          poster_url: show.poster_url || null,
          genres: show.genres || [],
          release_date: show.release_date || "",
          overview: show.overview || "",
          runtime: show.runtime || 0,
          rating: typeof show.rating === "number" ? show.rating : 0,
          type: "tv" as const,
          status: show.status || null,
          network: show.network || undefined,
          language: show.language || show.original_language || null,
          created_at: new Date().toISOString(),
        }));

        setQuickLogResults([...movieResults, ...showResults].slice(0, 20));
      } catch (error) {
        reportAppError({
          title: "Quick search failed",
          message: "We could not load search results.",
          details: error instanceof Error ? error.stack || error.message : String(error),
        });
      } finally {
        if (requestId === quickLogRequestRef.current) {
          setQuickLogSearching(false);
        }
      }
    }, queryText.trim().length === 1 ? 700 : 450);
  };

  useEffect(() => {
    if (showQuickLogSearch && quickLogQuery.trim().length >= 2) {
      void handleQuickLogSearch(quickLogQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickLogFilter]);

  const handleSelectQuickLogContent = (content: Content) => {
    setQuickLogContent(content);
    setShowQuickLogSearch(false);
    setShowQuickLogModal(true);
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      reportAppError({
        title: "Sign out failed",
        message: "We could not sign you out right now.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  };

  if (loading) {
    return null;
  }

  const friendLogVisitCounts = friendLogs.reduce<Record<string, number>>((counts, log) => {
    const key = `${log.friend.id}:${log.content_type}:${log.content.id}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const repeatWatchKeys = new Set<string>();

  const friendActivity = friendLogs
    .map((log) => {
      const friendName = getDisplayUserName(log.friend, user);

      return {
        id: `log-${log.id}`,
        poster_url: log.content?.poster_url || null,
        title: log.content?.title || "Unknown",
        byline: `by ${friendName}`,
        avatarUrl: log.friend.avatar_url || null,
        avatarLabel: friendName,
        repeatWatch: (() => {
          const key = `${log.friend.id}:${log.content_type}:${log.content.id}`;
          const shouldShow = (friendLogVisitCounts[key] || 0) > 1 && !repeatWatchKeys.has(key);
          repeatWatchKeys.add(key);
          return shouldShow;
        })(),
        reaction: log.reaction == null ? "Unrated" : log.reaction === 2 ? "Masterpiece" : log.reaction === 1.5 ? "Average" : log.reaction === 1 ? "Good" : "Bad",
        createdAt: log.created_at,
        onClick: () => {
          setPendingLoadingTitle(log.content?.title);
          router.push(buildLogUrl(log));
        },
      };
    })
    .sort((a, b) => getActivityTimestamp(b.createdAt) - getActivityTimestamp(a.createdAt))
    .slice(0, 8);
  const filteredQuickLogResults = quickLogResults.filter(
    (result) => quickLogFilter === "all" || result.type === quickLogFilter
  );
  const contentSearchResults = searchResults.filter(
    (result): result is Content => isContentSearchResult(result)
  );
  const crewSearchResults = searchResults.filter(
    (result): result is SearchCrewResult => isCrewSearchResult(result)
  );
  const visibleContentResults = contentSearchResults.filter((result) => {
    if (searchFilter === "all") return true;
    if (searchFilter === "movie") return result.type === "movie";
    if (searchFilter === "tv") return result.type === "tv";
    return false;
  });
  const totalSearchResults = contentSearchResults.length + crewSearchResults.length + accountResults.length;
  const hasSearchPanel =
    showSearchModal &&
    (searchQuery.trim().length > 0 ||
      totalSearchResults > 0 ||
      searchHistory.length > 0 ||
      searching ||
      searchFilter === "accounts");
  const hasFriendActivity = friendActivity.length > 0;

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <main className="mx-auto min-h-screen w-full max-w-[860px] bg-black px-1 pb-8 pt-2 text-[#f5f0de] sm:px-4 sm:pt-4">
        {/* Search Bar */}
        <div className="mb-7 sm:mb-8">
          <div className="relative z-30 w-full">
            <Search className="pointer-events-none absolute left-4 top-[23px] z-20 h-[18px] w-[18px] -translate-y-1/2 text-white/40" strokeWidth={2.25} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search movies, shows, people, and usernames"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setShowSearchModal(true)}
              className={`relative z-10 w-full border bg-black py-3 pl-11 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/35 focus:border-[#ff7a1a]/50 sm:text-[15px] ${
                hasSearchPanel
                  ? "rounded-t-2xl rounded-b-none border-white/10 border-b-transparent pr-20 shadow-[0_16px_55px_rgba(0,0,0,0.45)]"
                  : "rounded-full border-white/10 pr-20 hover:bg-[#0d0d0d]"
              }`}
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                className="absolute right-4 top-[23px] z-20 -translate-y-1/2 text-xs font-bold text-[#ff9a52] underline decoration-[#ff7a1a]/45 underline-offset-4 transition hover:text-[#ffb47d]"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}

            {/* Dropdown Results */}
            {hasSearchPanel && (
              <div className="absolute left-0 right-0 top-full z-10 max-h-[min(72dvh,620px)] overflow-y-auto overscroll-contain rounded-b-2xl border border-t-0 border-white/10 bg-black/[0.98] shadow-[0_24px_80px_rgba(0,0,0,0.68)] backdrop-blur-xl">
                {searchQuery.trim().length === 0 && searchHistory.length > 0 && (
                  <div className="border-t border-white/[0.06] px-3 pb-2 pt-1">
                    <div className="flex items-center justify-between px-1 py-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">Recent searches</p>
                      <button
                        type="button"
                        onClick={clearSearchHistory}
                        className="text-xs font-bold text-[#ff9a52] underline decoration-[#ff7a1a]/40 underline-offset-4 hover:text-[#ffb47d]"
                      >
                        Clear all
                      </button>
                    </div>
                    <div>
                      {searchHistory.map((item) => (
                        <div
                          key={item}
                          className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/5"
                        >
                          <button
                            type="button"
                            onClick={() => handleSearch(item)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <Clock className="h-4 w-4 flex-shrink-0 text-white/35" />
                            <span className="truncate text-sm text-[#f5f0de]">{item}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSearchHistoryItem(item)}
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/30 opacity-0 transition hover:bg-white/10 hover:text-white/70 group-hover:opacity-100"
                            aria-label={`Remove ${item} from recent searches`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchQuery.trim().length === 0 && searchHistory.length === 0 && searchFilter === "accounts" && (
                  <div className="border-t border-white/[0.06] p-4 text-sm text-white/55">
                    Start typing a name or username to find people and add friends.
                  </div>
                )}

                {/* Filter Buttons */}
                <div
                  className="sticky top-0 z-10 flex overflow-x-auto border-b border-t border-white/[0.08] bg-black/95 px-3 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="tablist"
                  aria-label="Search result filters"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchFilter === "all"}
                    onClick={() => setSearchFilter("all")}
                    className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-bold transition-colors ${
                      searchFilter === "all"
                        ? "text-[#fff3e5] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#ff7a1a]"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchFilter === "movie"}
                    onClick={() => setSearchFilter("movie")}
                    className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-bold transition-colors ${
                      searchFilter === "movie"
                        ? "text-[#fff3e5] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#ff7a1a]"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchFilter === "tv"}
                    onClick={() => setSearchFilter("tv")}
                    className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-bold transition-colors ${
                      searchFilter === "tv"
                        ? "text-[#fff3e5] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#ff7a1a]"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    TV
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchFilter === "crew"}
                    onClick={() => setSearchFilter("crew")}
                    className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-bold transition-colors ${
                      searchFilter === "crew"
                        ? "text-[#fff3e5] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#ff7a1a]"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    Crew
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={searchFilter === "accounts"}
                    onClick={() => setSearchFilter("accounts")}
                    className={`relative flex flex-shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-bold transition-colors ${
                      searchFilter === "accounts"
                        ? "text-[#fff3e5] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#ff7a1a]"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    Users
                  </button>
                </div>

                {/* List Results */}
                <div className="px-3 pb-3">
                  {visibleContentResults.map((result) => (
                    <Link
                      key={`${result.type}-${result.id}`}
                      href={result.type === "tv" ? `/tv/${result.id}` : `/movie/${result.id}`}
                      prefetch={false}
                      onClick={() => setShowSearchModal(false)}
                      className="group flex min-w-0 items-center gap-4 border-b border-white/[0.07] px-1 py-3 transition-colors last:border-b-0 hover:bg-white/[0.035] sm:px-2"
                    >
                        <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-[0_8px_22px_rgba(0,0,0,0.35)] sm:h-24 sm:w-16">
                            {result.poster_url ? (
                              <Image
                                src={result.poster_url}
                                alt={result.title}
                                fill
                                sizes="(min-width: 640px) 64px, 56px"
                                className="object-cover"
                                placeholder="blur"
                                blurDataURL={getBlurDataUrl()}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-white/30">
                                <Film className="h-4 w-4" />
                              </div>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="truncate text-base font-bold text-[#f5f0de] transition group-hover:text-white">{result.title}</p>
                          <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-white/40">
                            <span className="font-semibold uppercase tracking-[0.12em] text-[#ff9a52]">{result.type === "tv" ? "TV show" : "Movie"}</span>
                            <span className="h-1 w-1 rounded-full bg-white/20" />
                            {result.release_date ? result.release_date.split("-")[0] : "N/A"}
                          </p>
                        </div>
                    </Link>
                    ))}

                  {(searchFilter === "all" || searchFilter === "crew") &&
                    crewSearchResults.map((result) => {
                      const knownWorks = getCrewKnownWorks(result, 2);
                      const profileImage = result.profile_path
                        ? `https://image.tmdb.org/t/p/w185${result.profile_path}`
                        : null;

                      return (
                        <Link
                          key={`crew-${result.id}`}
                          href={buildCrewPath(result)}
                          prefetch={false}
                          onClick={() => setShowSearchModal(false)}
                          className="group flex items-center gap-3 border-b border-white/[0.07] px-1 py-3 transition-colors last:border-b-0 hover:bg-white/[0.035] sm:px-2"
                        >
                          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#1a1a1a]">
                            {profileImage ? (
                              <Image src={profileImage} alt={result.name} fill sizes="44px" className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-white/45">
                                {result.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#f5f0de] transition group-hover:text-white sm:text-[15px]">{result.name}</p>
                            <p className="mt-1 truncate text-xs text-white/40">
                              <span className="font-semibold text-[#ff9a52]">{result.known_for_department || "Film & TV"}</span>
                              {knownWorks.length > 0 ? ` · Known for ${knownWorks.join(", ")}` : " · View credits"}
                            </p>
                          </div>
                        </Link>
                      );
                    })}

                  {(searchFilter === "all" || searchFilter === "accounts") && accountResults.map((account) => (
                    <Link
                      key={`account-${account.id || account.username}`}
                      href={`/profile/${account.username}`}
                      prefetch={false}
                      onClick={() => setShowSearchModal(false)}
                      className="group flex items-center gap-3 border-b border-white/[0.07] px-1 py-3 transition-colors last:border-b-0 hover:bg-white/[0.035] sm:px-2"
                    >
                        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-[#e7ddc7] bg-[#f5f0de]">
                          {account.avatar_url ? (
                            <img loading="lazy"
                              src={account.avatar_url}
                              alt={account.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#11100e]">
                              {account.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#f5f0de] transition group-hover:text-white sm:text-[15px]">{account.name}</p>
                          <p className="mt-1 truncate text-xs text-white/40"><span className="font-semibold text-[#ff9a52]">User</span> · @{account.username}</p>
                        </div>
                    </Link>
                  ))}

                  {searchFilter === "accounts" && accountResults.length === 0 && !searching && searchQuery.trim().length > 0 && (
                    <div className="px-2 py-8 text-center text-sm text-white/45">No users found.</div>
                  )}

                  {searchFilter === "crew" && crewSearchResults.length === 0 && !searching && searchQuery.trim().length > 0 && (
                      <div className="px-2 py-8 text-center text-sm text-white/45">No crew found.</div>
                    )}

                  {(searchFilter === "movie" || searchFilter === "tv") &&
                    visibleContentResults.length === 0 &&
                    !searching && (
                      <div className="px-2 py-8 text-center text-sm text-white/45">
                        No {searchFilter === "movie" ? "movies" : "TV shows"} found.
                      </div>
                    )}

                  {searchFilter === "all" && totalSearchResults === 0 && !searching && searchQuery.trim().length > 0 && (
                    <div className="px-2 py-8 text-center">
                      <p className="text-sm font-bold text-[#f5f0de]">No results found</p>
                      <p className="mt-1 text-xs text-white/40">Try another title, person, or username.</p>
                    </div>
                  )}
                </div>

                {searching && (
                  <div className="border-t border-white/[0.07] p-4 text-center text-white/55">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#ff7a1a]" />
                  </div>
                )}
              </div>
            )}

            {/* Close dropdown when clicking outside */}
            {showSearchModal && (
              <div
                className="fixed inset-0 z-0"
                onClick={() => setShowSearchModal(false)}
              />
            )}
          </div>
        </div>
        {/* Recently Watched Section (Current User) removed as requested */}

        {!user || (ownLogs !== null && !ownLogs.some((log) => !log.watch_later && Boolean(log.watched_date)) && friendActivityStatus === "ready" && (!hasFriendActivity || showNewUserPreview)) ? <NewUserGuide /> : null}

        {/* Friends Activity / Get Started Section */}
        <div className="mb-6">
          {user ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#f5f0de] sm:text-2xl">Friends Activity</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickLogQuery("");
                    setQuickLogResults([]);
                    setQuickLogFilter("all");
                    setShowQuickLogSearch(true);
                  }}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a] text-[#08090b] shadow-[0_8px_24px_rgba(255,122,26,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ff8d3b] sm:h-10 sm:w-10"
                  aria-label="Log a title"
                >
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {friendActivityStatus === "loading" ? null : friendActivityStatus === "error" ? (
                <div className="border border-white/10 bg-[#111111] px-4 py-6 text-sm text-white/60">
                  Friends activity could not load. <button type="button" onClick={() => setFriendActivityRetry((value) => value + 1)} className="font-semibold text-[#ffb36b] hover:underline">Retry</button>
                </div>
              ) : hasFriendActivity ? (
                <>
                  <div className="-mx-1 overflow-x-auto px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-3">
                      {friendActivity.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={item.onClick}
                          className="w-[calc(28.571%_-_0.857rem)] min-w-[calc(28.571%_-_0.857rem)] flex-shrink-0 cursor-pointer overflow-hidden border border-white/15 bg-[#0b0d10] text-left transition hover:border-[#ff7a1a]/55 hover:shadow-[0_12px_28px_rgba(0,0,0,0.4)] sm:w-[calc(22.222%_-_0.666rem)] sm:min-w-[calc(22.222%_-_0.666rem)]"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                            {item.poster_url ? (
                              <Image
                                src={item.poster_url}
                                alt={item.title}
                                fill
                                sizes="(max-width: 640px) 140px, 170px"
                                className="object-cover"
                                placeholder="blur"
                                blurDataURL={getBlurDataUrl()}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-white/40">No poster</div>
                            )}
                            {item.repeatWatch && (
                              <div className="absolute bottom-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[#ffb36b]" aria-label="Rewatched" title="Rewatched">
                                <RotateCcw className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="border-t border-white/10 p-1.5 sm:p-2.5">
                            <h3 className="truncate text-[9px] font-bold leading-tight text-[#f5f0de] sm:text-sm">{item.title}</h3>
                            <p className="mt-0.5 truncate text-[8px] leading-tight text-white/55 sm:mt-1 sm:text-xs">{item.byline}</p>
                            <div className="mt-1.5 text-[7px] font-bold uppercase text-[#ff7a1a] sm:mt-2.5 sm:text-[10px]">
                              {item.reaction === "Unrated" ? "Logged" : item.reaction}
                            </div>
                          </div>
                        </button>
                      ))}
                      <Link href="/friends/logs" className="flex w-[calc(28.571%_-_0.857rem)] min-w-[calc(28.571%_-_0.857rem)] flex-shrink-0 flex-col items-center justify-center gap-2 overflow-hidden border border-[#ff7a1a]/40 bg-[#ff7a1a]/[0.06] text-center text-[#ff8d3b] transition hover:border-[#ff7a1a]/70 hover:bg-[#ff7a1a]/10 sm:w-[calc(22.222%_-_0.666rem)] sm:min-w-[calc(22.222%_-_0.666rem)]">
                        <span className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 p-2">
                          <ArrowRight className="h-5 w-5" />
                          <span className="text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-xs">View All</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                </>
              ) : followingCount !== null && followingCount > 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#111111] px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-[#f5f0de]">Your friends’ logs will show up here.</p>
                  <p className="mt-1 text-xs text-white/55 sm:text-sm">Once they log a movie or TV show, you’ll see it in Friends Activity.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-white/10 bg-[#111111] p-3 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:gap-5 sm:p-4">
                  <div className="relative h-[96px] w-16 shrink-0 overflow-hidden rounded-md border border-[#ff7a1a]/40 bg-[#1b1714] shadow-[0_6px_18px_rgba(0,0,0,0.3)] sm:h-[112px] sm:w-[76px]">
                    <Image
                      src="https://image.tmdb.org/t/p/w342/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg"
                      alt="Friends TV series poster"
                      fill
                      sizes="94px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
                    <p className="text-sm font-bold tracking-tight text-[#f5f0de] sm:text-base">See what your friends are watching.</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">Their movie and TV logs will appear here.</p>
                    <button type="button" onClick={openAccountSearch} className="mt-3 inline-flex h-8 w-fit items-center justify-self-start gap-2 rounded-full bg-[#ff7a1a] px-3.5 text-xs font-bold text-[#101010] transition hover:bg-[#ff9142] sm:hidden">Find friends <ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <button type="button" onClick={openAccountSearch} className="hidden h-10 w-fit items-center justify-self-end gap-2 rounded-full bg-[#ff7a1a] px-4 text-sm font-bold text-[#101010] transition hover:bg-[#ff9142] sm:col-start-3 sm:inline-flex">Find friends <ArrowRight className="h-4 w-4" /></button>
                </div>
              )}
            </>
          ) : null}
        </div>

        <AdminFeaturedLists />
        <HomeGamesStrip />
        {user && ownLogs?.some((log) => !log.watch_later && Boolean(log.watched_date)) ? <HomeStatsBento user={user} logs={ownLogs} /> : null}

        {user && friendActivityStatus === "ready" && followingCount === 0 ? <ExploreLists userId={user.id} /> : null}
        {user && ownLogs !== null ? <OnThisDay user={user} logs={ownLogs} /> : null}
        {ownLogs !== null ? <ReleaseDay logs={ownLogs} /> : null}

        {showQuickLogSearch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-2 pt-2 sm:items-center sm:p-4">
            <div className="flex h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden border border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:h-auto sm:max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-6">
                <div>
                  <h2 className="text-lg font-black text-[#f5f0de] sm:text-xl">Search & Log</h2>
                  <p className="mt-1 text-sm text-white/55">Choose a movie or TV show, then log it here.</p>
                </div>
                <button
                  onClick={() => setShowQuickLogSearch(false)}
                  className="rounded-full border border-white/10 p-2 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                  aria-label="Close search modal"
                  title="Close search modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-white/10 p-4 sm:p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-white/40" />
                  <input
                    type="text"
                    placeholder="Search movies & shows..."
                    value={quickLogQuery}
                    onChange={(e) => handleQuickLogSearch(e.target.value)}
                    autoFocus
                    className="w-full border border-white/15 bg-[#0d0d0d] py-3 pl-10 pr-4 text-base text-[#f5f0de] outline-none focus:border-[#ff7a1a] focus:ring-2 focus:ring-[#ff7a1a]/20"
                  />
                </div>
              </div>

              {(quickLogResults.length > 0 || quickLogQuery.length >= 1 || quickLogSearching) && (
                <>
                  <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#111111] px-4 py-3 sm:px-6">
                    {(["all", "movie", "tv"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setQuickLogFilter(filter)}
                        className={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold leading-none transition-colors ${
                          quickLogFilter === filter
                            ? "bg-[#f5f0de] text-[#0a0a0a]"
                            : "bg-white/5 text-[#f5f0de]/75 hover:bg-white/10"
                        }`}
                      >
                        {filter === "all" ? "All" : filter === "movie" ? "Movies" : "TV Shows"}
                      </button>
                    ))}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {filteredQuickLogResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => handleSelectQuickLogContent(result)}
                        className="flex w-full cursor-pointer items-center gap-3 border-b border-white/10 p-4 text-left transition-colors last:border-b-0 hover:bg-white/5"
                      >
                        {result.poster_url ? (
                          <Image
                            src={result.poster_url}
                            alt={result.title}
                            width={56}
                            height={80}
                            className="h-20 w-14 object-cover"
                            placeholder="blur"
                            blurDataURL={getBlurDataUrl()}
                          />
                        ) : (
                          <div className="flex h-20 w-14 items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                            No Image
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold text-[#f5f0de]">{result.title}</h3>
                          <p className="text-sm text-white/55">{result.type === "tv" ? "TV Show" : "Movie"}</p>
                        </div>
                      </button>
                    ))}

                    {filteredQuickLogResults.length === 0 && quickLogQuery.length >= 1 && !quickLogSearching && (
                      <div className="p-10 text-center text-white/55">
                        No {quickLogFilter === "tv" ? "TV shows" : quickLogFilter === "movie" ? "movies" : "results"} found.
                      </div>
                    )}
                  </div>
                </>
              )}

            {quickLogQuery.length < 1 && !quickLogSearching && (
                <div className="p-12 text-center">
                  <Film className="mx-auto mb-3 h-12 w-12 text-white/20" />
                  <p className="text-white/60">Search for a movie or TV show you watched.</p>
                </div>
              )}

              {quickLogSearching && (
                <div className="p-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff7a1a]" />
                </div>
              )}
            </div>
          </div>
        )}

        {quickLogContent && user && (
          <LogMovieModal
            isOpen={showQuickLogModal}
            onClose={() => {
              setShowQuickLogModal(false);
              setQuickLogContent(null);
            }}
            content={quickLogContent}
            user={user}
            onLogCreated={(message) => {
              setShowQuickLogModal(false);
              setQuickLogContent(null);
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("cine_action_banner", message);
              }
              router.push("/logs");
            }}
            theme="brutalist"
          />
        )}


        {/* More Features section removed as requested */}

      </main>
    </PageLayout>
  );
}
