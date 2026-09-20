"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import TopActionBanner from "@/components/TopActionBanner";
import { User, ShareWithDetails, Content, MovieLogWithContent, TMDBPersonSearchResult } from "@/types";
import { db } from "@/lib/firebase";
import { isPermissionDeniedError } from "@/lib/firebase-errors";
import { equalTo, onValue, orderByChild, query, ref } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { searchMovies, searchPeople } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getFriendLogs } from "@/lib/friend-logs";
import { reportAppError } from "@/lib/report-error";
import { getDisplayUserName, getUsersByIds, searchUsersCached } from "@/lib/users";
import { getBlurDataUrl } from "@/lib/performance";
import { getTmdbPosterUrl } from "@/lib/performance";
import { buildCrewPath, getCrewKnownWorks } from "@/lib/crew";
import Link from "next/link";
import { ArrowRight, Clapperboard, Clock, Film, Loader2, MessageCircle, Plus, RotateCcw, Search, Share2, X } from "lucide-react";

const SEARCH_HISTORY_STORAGE_KEY = "cine_search_history";
const MAX_SEARCH_HISTORY = 8;

const ShareModal = dynamic(() => import("@/components/ShareModal"), { ssr: false });
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
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);
  const [friendLogs, setFriendLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [accountResults, setAccountResults] = useState<SearchAccount[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "tv" | "crew" | "accounts">("all");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showQuickLogSearch, setShowQuickLogSearch] = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogContent, setQuickLogContent] = useState<Content | null>(null);
  const [quickLogQuery, setQuickLogQuery] = useState("");
  const [quickLogResults, setQuickLogResults] = useState<Content[]>([]);
  const [quickLogSearching, setQuickLogSearching] = useState(false);
  const [quickLogFilter, setQuickLogFilter] = useState<"all" | "movie" | "tv">("all");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
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
      setShares([]);
      return;
    }

    let cancelled = false;
    let unsubscribeShares = () => {};

    const currentUser = sessionUser;
    setUser(currentUser);
    setLoading(false);

    void (async () => {
      try {
        const logs = await getFriendLogs(currentUser.id, 14, 20);
        if (!cancelled) {
          setFriendLogs(logs);
        }
      } catch (error) {
        reportAppError({
          title: "Friend activity failed",
          message: "We could not load your friends' logs.",
          details: error instanceof Error ? error.stack || error.message : String(error),
        });
      }

      if (cancelled) return;

      const sharesRef = query(
        ref(db, "shares"),
        orderByChild("receiver_id"),
        equalTo(currentUser.id)
      );
      unsubscribeShares = onValue(
        sharesRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            if (!cancelled) setShares([]);
            return;
          }

          const allShares = snapshot.val();
          const sharesList = Object.entries(allShares)
            .map(([id, data]: any) => ({
              id,
              ...data,
              created_at: data.created_at || data.createdAt || "",
            }))
            .filter((s: any) => s.receiver_id === currentUser.id)
            .sort(
              (a: any, b: any) =>
                getActivityTimestamp(b.created_at) - getActivityTimestamp(a.created_at)
            );

          try {
            const usersData = await getUsersByIds(sharesList.map((share: any) => share.sender_id));

            const sharesWithDetails: ShareWithDetails[] = sharesList.map((share: any) => ({
              ...share,
              movie: share.movie || null,
              sender: usersData[share.sender_id],
            }));

            if (!cancelled) {
              setShares(sharesWithDetails);
            }
          } catch (error) {
            reportAppError({
              title: "Shares failed to load",
              message: "We could not load your shares right now.",
              details: error instanceof Error ? error.stack || error.message : String(error),
            });
            if (!cancelled) {
              setShares(sharesList);
            }
          }
        },
        (error) => {
          if (isPermissionDeniedError(error)) {
            console.warn("Dashboard shares listener is unavailable with the current Firebase permissions.");
            if (!cancelled) {
              setShares([]);
            }
            return;
          }

          reportAppError({
            title: "Shares failed to load",
            message: "We could not load your shares right now.",
            details: error instanceof Error ? error.stack || error.message : String(error),
          });
          if (!cancelled) {
            setShares([]);
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubscribeShares();
    };
  }, [router, sessionLoading, sessionUser]);

  useEffect(() => {
    setSearchHistory(loadSearchHistory());
  }, []);

  useEffect(() => {
    saveSearchHistory(searchHistory);
  }, [searchHistory]);

  useEffect(() => {
    if (!bannerMessage) return;

    const timer = window.setTimeout(() => {
      setBannerMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

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

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (query.trim().length < 1) {
      setSearchResults([]);
      setAccountResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const [movies, shows, usersData, people] = await Promise.all([
          searchMovies(query),
          searchShows(query),
          searchUsersCached(query),
          searchPeople(query),
        ]);

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
    }, 250);
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

    if (quickLogTimerRef.current) {
      clearTimeout(quickLogTimerRef.current);
    }

    if (queryText.trim().length < 1) {
      setQuickLogResults([]);
      setQuickLogSearching(false);
      return;
    }

    setQuickLogSearching(true);
    const requestId = quickLogRequestRef.current + 1;
    quickLogRequestRef.current = requestId;
    quickLogTimerRef.current = setTimeout(async () => {
      try {
        const movies = quickLogFilter === "tv" ? [] : await searchMovies(queryText);
        const shows = quickLogFilter === "movie" ? [] : await searchShows(queryText);

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
    }, 250);
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

  // Separate unwatched shares for the home preview.
  const unwatchedShares = shares.filter((s: any) => !s.watched);

  const friendLogVisitCounts = friendLogs.reduce<Record<string, number>>((counts, log) => {
    const key = `${log.friend.id}:${log.content_type}:${log.content.id}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const repeatWatchKeys = new Set<string>();

  const friendActivity = [
    ...unwatchedShares.map((share) => {
      const senderName = share.sender ? getDisplayUserName(share.sender, user) : "Unknown";

      return {
        id: `share-${share.id}`,
        kind: "shared" as const,
        poster_url: (share.movie || share.content)?.poster_url || null,
        title: (share.movie || share.content)?.title || "Unknown",
        byline: `by ${senderName}`,
        avatarUrl: share.sender?.avatar_url || null,
        avatarLabel: senderName,
        note: share.note || null,
        reaction: "",
        createdAt: share.created_at,
        onClick: () => setSelectedShare(share),
      };
    }),
    ...friendLogs.map((log) => {
      const friendName = getDisplayUserName(log.friend, user);

      return {
        id: `log-${log.id}`,
        kind: "logged" as const,
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
    }),
  ]
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
      <TopActionBanner message={bannerMessage} />
      <main className="mx-auto min-h-screen w-full max-w-[860px] bg-black px-1 pb-8 pt-2 text-[#f5f0de] sm:px-4 sm:pt-4">
        {/* Search Bar */}
        <div className="mb-7 sm:mb-8">
          <div className="relative z-20 w-full">
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
                      onClick={() => setShowSearchModal(false)}
                      className="group flex items-center gap-3 border-b border-white/[0.07] px-1 py-3 transition-colors last:border-b-0 hover:bg-white/[0.035] sm:px-2"
                    >
                        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#1a1a1a]">
                          {account.avatar_url ? (
                            <img
                              src={account.avatar_url}
                              alt={account.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/55">
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
                  onClick={() => setShowQuickActions(true)}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#ff7a1a] text-[#08090b] shadow-[0_8px_24px_rgba(255,122,26,0.25)] transition hover:-translate-y-0.5 hover:bg-[#ff8d3b] sm:h-10 sm:w-10"
                  aria-label="Open quick actions"
                >
                  <Plus className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {hasFriendActivity ? (
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
                              <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                                No poster
                              </div>
                            )}
                            {item.kind === "logged" && item.repeatWatch && (
                              <div
                                className="absolute bottom-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[#ffb36b] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                                aria-label="Rewatched"
                                title="Rewatched"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="border-t border-white/10 p-1.5 sm:p-2.5">
                            <h3 className="truncate text-[9px] font-bold leading-tight text-[#f5f0de] sm:text-sm">
                              {item.title}
                            </h3>
                            <p className="mt-0.5 truncate text-[8px] leading-tight text-white/55 sm:mt-1 sm:text-xs">
                              {item.byline}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-1 sm:mt-2.5 sm:gap-2">
                              <span className="truncate text-[7px] font-bold uppercase text-[#ff7a1a] sm:text-[10px]">
                                {item.kind === "shared" ? "shared" : item.reaction}
                              </span>
                              {item.kind === "shared" && item.note ? (
                                <span
                                  className="inline-flex items-center justify-center text-[#f5f0de]"
                                  aria-label="Contains message"
                                  title="Contains message"
                                >
                                  <MessageCircle className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                                </span>
                              ) : (
                                <span className="min-h-[0.75rem]" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      <Link
                        href="/all-movies"
                        className="flex w-[calc(28.571%_-_0.857rem)] min-w-[calc(28.571%_-_0.857rem)] flex-shrink-0 flex-col items-center justify-center gap-2 overflow-hidden border border-[#ff7a1a]/40 bg-[#ff7a1a]/[0.06] text-center text-[#ff8d3b] transition hover:border-[#ff7a1a]/70 hover:bg-[#ff7a1a]/10 sm:w-[calc(22.222%_-_0.666rem)] sm:min-w-[calc(22.222%_-_0.666rem)]"
                      >
                        <span className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 p-2">
                          <ArrowRight className="h-5 w-5" />
                          <span className="text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-xs">
                            View All
                          </span>
                        </span>
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mx-auto flex max-w-sm flex-col items-center justify-center border border-white/10 bg-[#111111] px-4 py-8 text-center sm:py-10">
                  <Clapperboard className="mx-auto mb-3 h-10 w-10 text-white/20" />
                  <p className="font-medium text-[#f5f0de]">No friends yet</p>
                  <p className="mt-1 text-sm text-white/55">Find people to see what they watch and share.</p>
                  <button
                    type="button"
                    onClick={openAccountSearch}
                    className="mt-4 inline-flex items-center justify-center border border-[#ff7a1a] px-3 py-1.5 text-xs font-medium text-[#ffb36b] transition-colors hover:bg-[#ff7a1a]/10"
                  >
                    Add friends
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mx-auto flex max-w-lg flex-col items-center justify-center border border-white/10 bg-[#111111] px-4 py-8 text-center sm:px-6 sm:py-10">
              <Clapperboard className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="font-medium text-[#f5f0de]">Get started</p>
              <p className="mt-1 text-sm text-white/55">
                Sign in to log titles, build lists, and share what you&apos;re watching.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/auth/login?redirect=/dashboard"
                  className="inline-flex items-center justify-center border border-[#ff7a1a] px-3 py-1.5 text-xs font-medium text-[#ffb36b] transition-colors hover:bg-[#ff7a1a]/10"
                >
                  Sign in
                </Link>
                <Link
                  href="/lists"
                  className="inline-flex items-center justify-center border border-white/10 px-3 py-1.5 text-xs font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
                >
                  Browse lists
                </Link>
              </div>
            </div>
          )}
        </div>

        {showQuickActions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setShowQuickActions(false)}
              aria-label="Close quick actions"
            />
            <div className="relative w-full max-w-md border border-white/10 bg-[#111111] p-5 text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black text-[#f5f0de]">Create</h3>
                <button
                  type="button"
                  onClick={() => setShowQuickActions(false)}
                  className="rounded-full border border-white/10 p-2 text-white/55 transition hover:bg-white/5 hover:text-[#f5f0de]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="divide-y divide-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    setQuickLogQuery("");
                    setQuickLogResults([]);
                    setQuickLogFilter("all");
                    setShowQuickLogSearch(true);
                  }}
                  className="group flex w-full items-center gap-3.5 rounded-xl px-1.5 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#f5f0de]">
                    <Clapperboard className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 font-black text-[#f5f0de]">Log Title</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/50" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickActions(false);
                    router.push("/share");
                  }}
                  className="group flex w-full items-center gap-3.5 rounded-xl px-1.5 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#f5f0de]">
                    <Share2 className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 font-black text-[#f5f0de]">Share</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/50" />
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <div className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#111111] p-4">
                    {(["all", "movie", "tv"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setQuickLogFilter(filter)}
                        className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
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

        {/* Share Modal */}
        {selectedShare && (
          <ShareModal
            key={selectedShare.id}
            share={selectedShare}
            currentUserId={user?.id || ""}
            onClose={() => setSelectedShare(null)}
            user={user}
            theme="brutalist"
            onLogged={(message) => setBannerMessage(message)}
          />
        )}
      </main>
    </PageLayout>
  );
}
