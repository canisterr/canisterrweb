"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Plus, Share2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import TopActionBanner from "@/components/TopActionBanner";
import AddToListModal from "@/components/AddToListModal";
import LogMovieModal from "@/components/LogMovieModal";
import { auth, db } from "@/lib/firebase";
import { TMDB_TV_ID_OFFSET, type ShowDetails } from "@/lib/tvmaze";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getLogsForUser, getTvEpisodeLabel, getVisibleLogNotes } from "@/lib/logs";
import { signOut as authSignOut } from "@/lib/auth";
import { fetchContentActivity, type ContentActivityLog } from "@/lib/content-activity";
import DivideScoreDisplay from "@/components/DivideScoreDisplay";
import WatchProviders from "@/components/WatchProviders";
import { getLogEngagementBatch, type LogEngagementSnapshot } from "@/lib/log-engagement";
import LogFeedCard from "@/components/LogFeedCard";
import { buildCrewPath } from "@/lib/crew";
import { resolveTvRouteParam } from "@/lib/content-slugs";
import { User, Content, MovieLog, MovieLogWithContent } from "@/types";

function formatReleaseYear(releaseDate: string | null | undefined): string {
  if (!releaseDate) return "";
  const year = new Date(releaseDate).getFullYear();
  return Number.isNaN(year) ? releaseDate : String(year);
}

function formatRuntime(runtime: number | null | undefined): string {
  if (!runtime) return "";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatReleaseDate(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const date = new Date(`${releaseDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return releaseDate;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatLogDate(dateString: string | null | undefined): string {
  if (!dateString) return "Date unavailable";
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatLanguage(language: string | null | undefined): string | null {
  if (!language) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language;
  } catch {
    return language;
  }
}

type TVDetailTab = "cast" | "crew" | "details" | "reviews";

function getReactionLabelFromLogReaction(reaction: 0 | 1 | 1.5 | 2 | null | undefined): "Unrated" | "Bad" | "Average" | "Good" | "Masterpiece" {
  if (reaction == null) return "Unrated";
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1.5) return "Average";
  if (reaction === 1) return "Good";
  return "Bad";
}

type TVCreditPerson = {
  id: number;
  name: string;
  profile_url: string | null;
  job?: string | null;
  character?: string | null;
  department?: string | null;
};

function getCrewBucketLabel(job: string | null | undefined): string {
  if (!job) return "Crew";
  return job;
}

function getSeasonLabel(log: Pick<MovieLog, "content_type" | "season" | "episode" | "episode_title">): string {
  return getTvEpisodeLabel(log);
}

export default function TVShowPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showRouteParam = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const searchParamsString = searchParams.toString();
  const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<MovieLogWithContent[]>([]);
  const [reviewsEngagement, setReviewsEngagement] = useState<Record<string, LogEngagementSnapshot>>({});
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
  const [userLogHistory, setUserLogHistory] = useState<MovieLog[]>([]);
  const [friendLogs, setFriendLogs] = useState<MovieLogWithContent[]>([]);
  const [allLogs, setAllLogs] = useState<MovieLogWithContent[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<TVDetailTab>("cast");
  const [showStats, setShowStats] = useState({ totalLogs: 0, totalWatched: 0 });
  const [resolvedShowPath, setResolvedShowPath] = useState<string | null>(null);

  const applyActivityPayload = (
    activity: {
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
    },
    currentUserId: string,
    showContent?: ShowDetails | null,
    currentUsername?: string
  ) => {
    setReactionBreakdown({
      bad: activity.stats.bad,
      average: activity.stats.average,
      good: activity.stats.good,
      masterpiece: activity.stats.masterpiece,
      total: activity.stats.total,
    });
    setShowStats({ totalLogs: activity.stats.totalLogs, totalWatched: activity.stats.totalWatched });

    const logsWithContent = activity.logs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content:
        (showContent
          ? ({ ...showContent, created_at: new Date().toISOString() } as Content)
          : ({
              id: log.content_id,
              title: "Unknown Show",
              name: "Unknown Show",
              poster_url: null,
              genres: [],
              actors: [],
              language: null,
              status: null,
              release_date: null,
              overview: null,
              runtime: null,
              rating: null,
              created_at: new Date().toISOString(),
              type: "tv",
            } as Content)),
    })) as MovieLogWithContent[];

    const isOwnLog = (log: MovieLogWithContent) =>
      log.user_id === currentUserId ||
      Boolean(currentUsername && log.user?.username?.toLowerCase() === currentUsername.toLowerCase());
    const history = logsWithContent
      .filter(isOwnLog)
      .sort((a, b) => {
        const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
        if (watchedDiff !== 0) return watchedDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    setUserLogHistory(history.map((log) => ({ ...log, notes: getVisibleLogNotes(log) })));

    const latestLogByUser = new Map<string, MovieLogWithContent>();
    logsWithContent.forEach((log) => {
      if (
        !latestLogByUser.has(log.user_id) ||
        new Date(log.created_at) > new Date(latestLogByUser.get(log.user_id)!.created_at)
      ) {
        latestLogByUser.set(log.user_id, log);
      }
    });

    const dedupedLogs = Array.from(latestLogByUser.values());
    setFriendLogs(dedupedLogs.filter((log) => !isOwnLog(log)));
    setAllLogs(dedupedLogs);
  };

  const loadShowLogData = async (
    showContentId: number,
    currentUserId: string,
    showContent?: ShowDetails | null,
    currentUsername?: string
  ) => {
    if (!showContentId || Number.isNaN(showContentId)) {
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setShowStats({ totalLogs: 0, totalWatched: 0 });
      setUserLogHistory([]);
      setReviews([]);
      setReviewsEngagement({});
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }
    const activity = await fetchContentActivity(showContentId, "tv").catch(() => ({
      logs: [] as ContentActivityLog[],
      stats: { bad: 0, average: 0, good: 0, masterpiece: 0, total: 0, totalLogs: 0, totalWatched: 0 },
    }));
    applyActivityPayload(activity, currentUserId, showContent, currentUsername);

    const contentLogs = activity.logs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content: showContent as Content,
    })) as MovieLogWithContent[];

    if (currentUserId !== "__guest__" && !contentLogs.some((log) =>
      log.user_id === currentUserId ||
      Boolean(currentUsername && log.user?.username?.toLowerCase() === currentUsername.toLowerCase())
    )) {
      const matchingShowIds = new Set([
        showContentId,
        showContent?.tmdb_id,
        showContent?.tmdb_id ? TMDB_TV_ID_OFFSET + showContent.tmdb_id : null,
        showContent?.tvmaze_id,
      ].filter((id): id is number => typeof id === "number"));
      const ownLogs = (await getLogsForUser(currentUserId))
        .filter((log) => log.content_type === "tv" && matchingShowIds.has(Number(log.content_id)) && !log.watch_later && Boolean(log.watched_date))
        .sort((a, b) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime());
      setUserLogHistory(ownLogs.map((log) => ({ ...log, notes: getVisibleLogNotes(log) })));
    }

    const reviewLogs = contentLogs.filter((log) => getVisibleLogNotes(log).trim().length > 0);
    setReviews(reviewLogs);

    const engagement = await getLogEngagementBatch(
      reviewLogs.slice(0, 5).map((log) => log.id),
      currentUserId
    );
    setReviewsEngagement(engagement);
  };

  useEffect(() => {
    if (!bannerMessage) return;

    const timer = window.setTimeout(() => {
      setBannerMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching TV auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadShowPage = async () => {
      try {
        setLoading(true);
        setReviews([]);
        setReviewsEngagement({});
        setFriendLogs([]);
        setAllLogs([]);
        setUserLogHistory([]);
        setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
        setShowStats({ totalLogs: 0, totalWatched: 0 });
        const resolved = await resolveTvRouteParam(showRouteParam);

        if (cancelled) return;

        if (!resolved) {
          setShow(null);
          setResolvedShowPath(null);
          setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
          setUserLogHistory([]);
          setReviews([]);
          setFriendLogs([]);
          setAllLogs([]);
          setLoading(false);
          return;
        }

        setShow(resolved.show);
        setResolvedShowPath(resolved.canonicalPath);

        if (pathname !== resolved.canonicalPath) {
          const nextUrl = searchParamsString
            ? `${resolved.canonicalPath}?${searchParamsString}`
            : resolved.canonicalPath;
          router.replace(nextUrl);
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching TV show details:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadShowPage();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParamsString, showRouteParam]);

  useEffect(() => {
    if (!show) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void loadShowLogData(show.id, user?.id || "__guest__", show, user?.username).catch((error) => {
        if (!cancelled) {
          console.error("Error fetching TV activity:", error);
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [show, user?.id]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const requireLoginForAction = () => {
    router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  const handleOpenLogModal = () => {
    if (!user) {
      requireLoginForAction();
      return;
    }

    setShowLogMovieModal(true);
  };

  const handleOpenAddToListModal = () => {
    if (!user) {
      requireLoginForAction();
      return;
    }

    setShowAddToListModal(true);
  };

  const handleShareShow = () => {
    if (!user || !show) {
      requireLoginForAction();
      return;
    }

    router.push(`/share?show_id=${show.id}`);
  };

  const myReviewLog = allLogs.length > 0 && user
    ? [...allLogs]
        .filter((log) => log.user_id === user.id || log.user?.username?.toLowerCase() === user.username.toLowerCase())
        .sort((a, b) => {
          const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
          if (watchedDiff !== 0) return watchedDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })[0] || null
    : null;
  const castPeople = useMemo(() => show?.cast_details || [], [show]);
  const crewPeople = useMemo(() => show?.crew_details || [], [show]);
  const showBackdropUrl = show?.backdrop_url || show?.backdrop_gallery_urls?.[0] || show?.poster_url || null;
  const hasWideBackdrop = Boolean(show?.backdrop_url || show?.backdrop_gallery_urls?.length);
  const showFacts = [
    { label: "First aired", value: formatReleaseDate(show?.release_date || show?.premiered) },
    { label: "Episode", value: formatRuntime(show?.runtime) },
    { label: "Language", value: formatLanguage(show?.language) },
    { label: "Status", value: show?.status },
    { label: "Network", value: show?.network?.name },
    { label: "Seasons", value: show?.season_count ? String(show.season_count) : null },
    { label: "Episodes", value: show?.episode_count ? String(show.episode_count) : null },
    { label: "Origin", value: show?.origin_countries?.join(", ") },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
  const showSeasonsHref = show
    ? `${resolvedShowPath || `/tv/${show.id}`}/seasons`
    : "/dashboard";

  const renderCastRow = (person: TVCreditPerson) => (
    <Link
      key={person.id}
      href={buildCrewPath({ id: person.id, name: person.name })}
      className="flex min-w-0 items-center gap-3 py-2 text-left transition-opacity hover:opacity-75"
    >
      <div className="h-16 w-12 flex-shrink-0 overflow-hidden bg-white/10">
        {person.profile_url ? (
          <img loading="lazy" src={person.profile_url} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base font-black text-white/35">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{person.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55 sm:text-sm">
          {person.character || "Character unavailable"}
        </p>
      </div>
    </Link>
  );

  const renderCrewRow = (person: TVCreditPerson) => (
    <Link
      key={`${person.id}-${person.job || person.department || "crew"}`}
      href={buildCrewPath({ id: person.id, name: person.name })}
      className="flex min-w-0 items-center gap-3 py-2 text-left transition-opacity hover:opacity-75"
    >
      <div className="h-16 w-12 flex-shrink-0 overflow-hidden bg-white/10">
        {person.profile_url ? (
          <img loading="lazy" src={person.profile_url} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base font-black text-white/35">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{person.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55 sm:text-sm">
          {getCrewBucketLabel(person.job || person.department)}
        </p>
      </div>
    </Link>
  );

  if (loading) {
    return null;
  }

  if (!show) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">TV Show not found</p>
          <Link href="/dashboard" className="mt-4 inline-block text-[#f5f0de]">
            Back to Home
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} fullWidth>
      <TopActionBanner message={bannerMessage} />
      <div className="min-h-screen bg-black text-white">
        <section className={showBackdropUrl ? "relative overflow-hidden" : ""}>
          {showBackdropUrl ? (
            <div className="relative h-[42svh] min-h-[300px] sm:h-[46svh] sm:min-h-[320px] lg:h-[48svh] lg:min-h-[340px]">
              <img loading="lazy"
                src={showBackdropUrl}
                alt={`${show.title || show.name} backdrop`}
                className={`absolute inset-0 h-full w-full object-cover object-center ${hasWideBackdrop ? "" : "scale-110 opacity-60 blur-xl"}`}
                style={{ objectPosition: "center center" }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.18)_34%,rgba(0,0,0,0.48)_68%,rgba(0,0,0,0.92)_100%)]" />

              <div className="relative z-10 mx-auto flex h-full max-w-7xl items-start px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:border-[#ff8a1e]/40 hover:bg-black/70 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:border-[#ff8a1e]/40 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}

          <div className="relative z-10 bg-black">
            <div className={`mx-auto max-w-5xl px-4 pb-5 sm:px-6 sm:pb-7 lg:px-8 ${showBackdropUrl ? "pt-5 sm:pt-6 lg:pt-8" : "pt-4 sm:pt-5 lg:pt-6"}`}>
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/45">
                  {[
                    show.release_date ? formatReleaseYear(show.release_date) : null,
                    show.runtime ? formatRuntime(show.runtime) : null,
                    show.language ? show.language.toUpperCase() : null,
                    show.status,
                    show.network?.name || null,
                  ].filter(Boolean).map((part, index) => (
                    <span key={`${part}-${index}`}>{part}</span>
                  ))}
                </div>

                <h1
                  className="mt-4 text-[clamp(3rem,9vw,5.75rem)] font-black leading-[0.9] tracking-tight text-[#f5f0de]"
                  style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                >
                  {show.title}
                </h1>

                {show.genres && show.genres.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[#ffb36b]">
                    {show.genres.slice(0, 4).map((genre, index) => (
                      <span key={genre} className="inline-flex items-center">
                        {index > 0 && <span className="mr-2 text-white/30">,</span>}
                        <span>{genre}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    onClick={handleOpenLogModal}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ff7a1a] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#ff9847]"
                  >
                    Log
                  </button>
                  <button
                    onClick={handleShareShow}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#171717] px-4 text-sm font-medium text-[#f5f0de] transition-colors hover:border-white/30 hover:bg-[#222]"
                  >
                    <Share2 className="h-4 w-4" strokeWidth={1.8} />
                    Share
                  </button>
                  <button
                    onClick={handleOpenAddToListModal}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#171717] px-4 text-sm font-medium text-[#f5f0de] transition-colors hover:border-white/30 hover:bg-[#222]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.8} />
                    Add to List
                  </button>
                  <Link
                    href={showSeasonsHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 bg-[#171717] px-4 text-sm font-medium text-[#f5f0de] transition-colors hover:border-white/30 hover:bg-[#222]"
                  >
                    Seasons
                  </Link>
                </div>

                {show.overview && (
                  <div className="mt-8">
                    <h2 className="text-3xl font-black tracking-tight text-[#f5f0de]">Overview</h2>
                    <p className="mt-3 max-w-4xl text-base leading-8 text-white/68 sm:text-[1.08rem]">
                      {show.overview}
                    </p>
                  </div>
                )}

                <div className="mt-8 w-full max-w-3xl text-center">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/45">
                    <span>Rating distribution</span>
                    <span>{reactionBreakdown.total} rating{reactionBreakdown.total === 1 ? "" : "s"}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    {reactionBreakdown.total > 0 ? (
                      <div className="flex h-full w-full">
                        {[
                          { label: "Bad", value: reactionBreakdown.bad, color: "bg-rose-400" },
                          { label: "Average", value: reactionBreakdown.average, color: "bg-amber-400" },
                          { label: "Good", value: reactionBreakdown.good, color: "bg-emerald-400" },
                          { label: "Masterpiece", value: reactionBreakdown.masterpiece, color: "bg-orange-400" },
                        ].map((item) => {
                          const percent = (item.value / reactionBreakdown.total) * 100;
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => setBannerMessage(`${item.value} ${item.label.toLowerCase()} rating${item.value === 1 ? "" : "s"}`)}
                              className={`${item.color} h-full transition-opacity hover:opacity-90`}
                              style={{ width: `${percent}%` }}
                              aria-label={`${item.label} ${item.value}`}
                              title={`${item.label} ${item.value}`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full w-full rounded-full bg-slate-500/60" />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    {reactionBreakdown.total > 0 && (
                      <div className="-mx-1 mt-3 flex flex-nowrap justify-center gap-3 overflow-x-auto px-1 pb-1 text-[10px] text-white/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          Bad {reactionBreakdown.bad}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          Average {reactionBreakdown.average}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          Good {reactionBreakdown.good}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                          Masterpiece {reactionBreakdown.masterpiece}
                        </span>
                      </div>
                    )}
                  </div>
                  <DivideScoreDisplay counts={reactionBreakdown} />
                  {myReviewLog && (
                    <div className="mt-5 border-l-2 border-[#ff7a1a] bg-[#ff7a1a]/[0.06] py-3 pl-4 pr-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff9b52]">Your log is saved</p>
                          <p className="mt-1 text-xs text-white/55">Watched {formatLogDate(myReviewLog.watched_date)}</p>
                        </div>
                        <span className="rounded-full border border-[#ff7a1a]/35 bg-[#ff7a1a]/10 px-2.5 py-1 text-[10px] font-bold text-[#ffb36b]">
                          {getReactionLabelFromLogReaction(myReviewLog.reaction)}
                        </span>
                      </div>
                      {myReviewLog.notes?.trim() && <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/80">{myReviewLog.notes}</p>}
                      <button
                        type="button"
                        onClick={() => {
                          setPendingLoadingTitle(show?.title || show?.name || myReviewLog.content?.title);
                          router.push(buildLogUrl(myReviewLog));
                        }}
                        className="mt-3 text-xs font-bold text-[#ffb36b] transition hover:text-[#ffd0a6]"
                      >
                        Open your log <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    <div className="flex min-w-0 flex-col items-center text-center">
                      <span className="text-xs text-white/45">Reviews</span>
                      <span className="mt-1 text-lg font-black text-[#f5f0de]">{reviews.length}</span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center text-center">
                      <span className="text-xs text-white/45">Logs</span>
                      <span className="mt-1 text-lg font-black text-[#f5f0de]">{showStats.totalLogs}</span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center text-center">
                      <span className="text-xs text-white/45">Viewers</span>
                      <span className="mt-1 text-lg font-black text-[#f5f0de]">{showStats.totalWatched}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-black">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
            {userLogHistory.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-base font-semibold text-[#f5f0de]">Your log history</h2>
                  <span className="text-xs text-white/40">{userLogHistory.length} log{userLogHistory.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                  {userLogHistory.map((log) => (
                    <Link key={log.id} href={`/logs/${log.id}`} className="group flex min-w-0 items-center gap-3 py-3 text-left transition hover:bg-white/[0.025]">
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f0de] text-sm font-black text-[#0a0a0a]">
                        {user?.avatar_url ? <img loading="lazy" src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : (user?.name || "You").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#f5f0de] group-hover:text-[#ffb36b]">
                          {user?.name || "You"} <span className="font-normal text-white/40">· {new Date(log.watched_date).toLocaleDateString()}</span>
                        </span>
                        <span className="block truncate text-xs text-white/40">{getSeasonLabel(log) || "Show log"}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-[#ffb36b]">{getReactionLabelFromLogReaction(log.reaction)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {friendLogs.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-base font-semibold text-[#f5f0de]">Seen by your circle</h2>
                  <span className="text-xs text-white/40">{friendLogs.length} watched</span>
                </div>
                <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                  {friendLogs.slice(0, 10).map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      className="group flex min-w-0 items-center gap-3 py-3 text-left transition hover:bg-white/[0.025]"
                      onClick={() => {
                        setPendingLoadingTitle(show?.title || show?.name || log.content?.title);
                        router.push(buildLogUrl(log));
                      }}
                      title={`View ${log.user.name}'s log`}
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f0de] text-sm font-black text-[#0a0a0a]">
                        {log.user.avatar_url ? <img loading="lazy" src={log.user.avatar_url} alt="" className="h-full w-full object-cover" /> : log.user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#f5f0de] group-hover:text-[#ffb36b]">{log.user.name}</span>
                        <span className="block truncate text-xs text-white/40">{getSeasonLabel(log) || `@${log.user.username}`}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-[#ffb36b]">{getReactionLabelFromLogReaction(log.reaction)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <WatchProviders regions={show.watch_providers} />

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.16em] text-white/55 sm:text-base sm:tracking-[0.2em]">
                {(["cast", "crew", "details", "reviews"] as TVDetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveDetailTab(tab)}
                    className={`border-b-2 px-2 py-2 capitalize transition-colors ${
                      activeDetailTab === tab
                        ? "border-[#ff8a1e] text-[#ffb36b]"
                        : "border-transparent text-white/45 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                {activeDetailTab === "cast" && (
                  <section className="space-y-5">
                    <h2 className="text-2xl font-bold">Cast</h2>
                    {castPeople.length > 0 ? (
                      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                        {castPeople.map(renderCastRow)}
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">No cast data available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "crew" && (
                  <section className="space-y-5">
                    <h2 className="text-2xl font-bold">Crew</h2>
                    {crewPeople.length > 0 ? (
                      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                        {crewPeople.map(renderCrewRow)}
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">No crew credits available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "details" && (
                  <section className="space-y-8">
                    <h2 className="text-2xl font-bold text-[#f5f0de]">Show details</h2>
                    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                        {showFacts.map((fact) => (
                          <div key={fact.label}>
                            <dt className="text-xs text-white/45">{fact.label}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[#f5f0de]">{fact.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div>
                        {(show.genres?.length || 0) > 0 && (
                          <div>
                            <h3 className="text-xs uppercase tracking-[0.2em] text-white/45">Genres</h3>
                            <p className="mt-2 text-sm leading-6 text-[#f5f0de]">{(show.genres || []).join(" · ")}</p>
                          </div>
                        )}
                        <Link href={showSeasonsHref} className="mt-5 inline-block text-sm font-semibold text-[#ffb36b] hover:text-[#ffcf9b]">
                          Explore seasons →
                        </Link>
                      </div>
                    </div>
                    {show.backdrop_gallery_urls && show.backdrop_gallery_urls.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">Stills</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {show.backdrop_gallery_urls.slice(0, 6).map((url) => (
                            <img loading="lazy" key={url} src={url} alt={`${show.title || show.name} still`} className="aspect-video w-full object-cover" />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {activeDetailTab === "reviews" && (
                  <section className="space-y-5">
                    <h2 className="text-2xl font-bold">Reviews</h2>
                    {reviews.length > 0 ? (
                      <div className="grid gap-4">
                        {reviews.slice(0, 5).map((review) => (
                          <LogFeedCard
                            key={review.id}
                            log={review}
                            currentUser={user}
                            engagement={reviewsEngagement[review.id]}
                            onEngagementChange={(logId, patch) =>
                              setReviewsEngagement((current) => ({
                                ...current,
                                [logId]: { ...current[logId], ...patch } as LogEngagementSnapshot,
                              }))
                            }
                            onDeleted={(logId) => setReviews((current) => current.filter((log) => log.id !== logId))}
                            onUpdated={(updated) =>
                              setReviews((current) => current.map((log) => (log.id === updated.id ? updated : log)))
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                        No reviews yet. Be the first to review.
                      </div>
                    )}
                  </section>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        content={show as Content}
        user={user}
      />

      <LogMovieModal
        isOpen={showLogMovieModal}
        onClose={() => setShowLogMovieModal(false)}
        content={show as Content}
        user={user}
        onLogCreated={(message) => {
          setBannerMessage(message);
          if (user && show) {
            void loadShowLogData(show.id, user.id, show);
          }
        }}
      />
    </PageLayout>
  );
}
