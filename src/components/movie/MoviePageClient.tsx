"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useParams, usePathname, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import DivideScoreDisplay from "@/components/DivideScoreDisplay";
import WatchProviders from "@/components/WatchProviders";
import TopActionBanner from "@/components/TopActionBanner";
import AddToListModal from "@/components/AddToListModal";
import LogMovieModal from "@/components/LogMovieModal";
import { User, Movie, Content, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { addToWatchlist, getLogsForUser, getVisibleLogNotes, setWatchlistCountdown } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { fetchContentActivity, type ContentActivityLog } from "@/lib/content-activity";
import { getLogEngagementBatch, type LogEngagementSnapshot } from "@/lib/log-engagement";
import LogFeedCard from "@/components/LogFeedCard";
import { buildCrewPath } from "@/lib/crew";
import { resolveMovieRouteParam } from "@/lib/content-slugs";
import {
  ArrowLeft,
  LogsIcon,
  ChevronRight,
  ChevronDown,
  Bookmark,
  Check,
  Plus,
  Share2,
} from "lucide-react";
import Link from "next/link";

type MovieCreditPerson = {
  id: number;
  name: string;
  profile_url: string | null;
  job?: string | null;
  character?: string | null;
  department?: string | null;
};

type MovieDetails = Movie & {
  cast_details?: MovieCreditPerson[];
  crew_details?: MovieCreditPerson[];
  trailer_key?: string | null;
};

type MovieDetailTab = "cast" | "crew" | "details" | "reviews";

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

function getReactionLabelFromLogReaction(reaction: 0 | 1 | 1.5 | 2 | null | undefined): "Unrated" | "Bad" | "Average" | "Good" | "Masterpiece" {
  if (reaction == null) return "Unrated";
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1.5) return "Average";
  if (reaction === 1) return "Good";
  return "Bad";
}

function getReactionBadgeClassFromLabel(label: "Unrated" | "Bad" | "Average" | "Good" | "Masterpiece"): string {
  if (label === "Unrated") return "bg-slate-500/20 text-slate-300 border-slate-400/30";
  if (label === "Masterpiece") return "bg-orange-500/20 text-orange-300 border-orange-400/30";
  if (label === "Average") return "bg-amber-500/20 text-amber-300 border-amber-400/30";
  if (label === "Good") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  return "bg-rose-500/20 text-rose-300 border-rose-400/30";
}


function getMovieMetaParts(movie: Movie | null): string[] {
  if (!movie) return [];

  const parts: string[] = [];
  if (movie.release_date) parts.push(formatReleaseYear(movie.release_date));
  if (movie.runtime) parts.push(formatRuntime(movie.runtime));
  if (movie.language) parts.push(movie.language.toUpperCase());
  return parts.filter(Boolean);
}

function getCrewBuckets(crew: MovieCreditPerson[]) {
  const buckets = {
    Directors: crew.filter((person) => person.job === "Director"),
    Producers: crew.filter((person) => ["Producer", "Executive Producer", "Co-Producer"].includes(person.job || "")),
    Cinematography: crew.filter((person) => ["Cinematography", "Director of Photography"].includes(person.job || "")),
    Editing: crew.filter((person) => person.job === "Editor"),
    Music: crew.filter((person) => ["Original Music Composer", "Music"].includes(person.job || "")),
  };

  return Object.entries(buckets).filter(([, people]) => people.length > 0);
}

function getDisplayUserLabel(user: User): string {
  if (user.name && user.name.trim()) return user.name;
  if (user.username && user.username !== user.id) return `@${user.username}`;
  return "User";
}

export default function MoviePage({ initialResolved }: {
  initialResolved: Awaited<ReturnType<typeof resolveMovieRouteParam>>;
}) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const movieRouteParam = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const searchParamsString = searchParams.toString();
  const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;
  const isScanLogFlow = searchParams.get("log") === "1" && searchParams.get("from") === "scan";
  const autoOpenScanLogRef = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<MovieLogWithContent[]>([]);
  const [reviewsEngagement, setReviewsEngagement] = useState<Record<string, LogEngagementSnapshot>>({});
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);
  const [showScanThanksModal, setShowScanThanksModal] = useState(false);
  const [reactionBreakdown, setReactionBreakdown] = useState({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
  const [movieStats, setMovieStats] = useState({ totalLogs: 0, totalWatched: 0 });
  const [friendLogs, setFriendLogs] = useState<MovieLogWithContent[]>([]);
  const [allLogs, setAllLogs] = useState<MovieLogWithContent[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<MovieDetailTab>("cast");
  const [showAllCast, setShowAllCast] = useState(false);
  const [watchlistState, setWatchlistState] = useState<"idle" | "saving" | "saved">("idle");
  const [watchlistLogId, setWatchlistLogId] = useState<string | null>(null);
  const [countdownState, setCountdownState] = useState<"idle" | "saving" | "shown">("idle");
  const [resolvedMoviePath, setResolvedMoviePath] = useState<string | null>(null);

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
    movieContent?: MovieDetails | null
  ): MovieLogWithContent[] => {
    setReactionBreakdown({
      bad: activity.stats.bad,
      average: activity.stats.average,
      good: activity.stats.good,
      masterpiece: activity.stats.masterpiece,
      total: activity.stats.total,
    });
    setMovieStats({
      totalLogs: activity.stats.totalLogs,
      totalWatched: activity.stats.totalWatched,
    });

    const logsWithContent = activity.logs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content:
        (movieContent
          ? ({ ...movieContent, created_at: movieContent.created_at || new Date().toISOString() } as Content)
          : ({
              id: log.content_id,
              title: "Unknown Movie",
              poster_url: null,
              genres: [],
              platforms: [],
              director: null,
              actors: [],
              language: null,
              release_date: null,
              overview: null,
              runtime: null,
              rating: null,
              created_at: new Date().toISOString(),
              type: "movie",
            } as Content)),
    })) as MovieLogWithContent[];

    const latestLogByUser = new Map<string, MovieLogWithContent>();
    logsWithContent.forEach((log) => {
      if (!latestLogByUser.has(log.user_id) || new Date(log.created_at) > new Date(latestLogByUser.get(log.user_id)!.created_at)) {
        latestLogByUser.set(log.user_id, log);
      }
    });

    const dedupedLogs = Array.from(latestLogByUser.values());
    setFriendLogs(dedupedLogs.filter((log) => log.user_id !== currentUserId));
    setAllLogs(dedupedLogs.filter((log) => log.user_id === currentUserId));
    return logsWithContent;
  };

  const loadMovieLogData = async (
    movieContentId: number,
    currentUserId: string,
    movieContent?: MovieDetails | null
  ) => {
    if (!movieContentId || Number.isNaN(movieContentId)) {
      setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
      setMovieStats({ totalLogs: 0, totalWatched: 0 });
      setReviews([]);
      setReviewsEngagement({});
      setFriendLogs([]);
      setAllLogs([]);
      return;
    }
    const activity = await fetchContentActivity(movieContentId, "movie");
    const contentLogs = applyActivityPayload(activity, currentUserId, movieContent);

    const reviewLogs = contentLogs.filter((log) => getVisibleLogNotes(log).trim().length > 0);
    setReviews(reviewLogs);

    const engagement = await getLogEngagementBatch(
      reviewLogs.map((log) => log.id),
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
        // Fetch current user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
      } catch (error) {
        console.error("Error fetching movie auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMoviePage = async () => {
      try {
        setLoading(true);
        setReviews([]);
        setReviewsEngagement({});
        setFriendLogs([]);
        setAllLogs([]);
        setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
        setMovieStats({ totalLogs: 0, totalWatched: 0 });
        const resolved = initialResolved ?? await resolveMovieRouteParam(movieRouteParam);

        if (cancelled) return;

        if (!resolved) {
          setMovie(null);
          setResolvedMoviePath(null);
          setReactionBreakdown({ bad: 0, average: 0, good: 0, masterpiece: 0, total: 0 });
          setMovieStats({ totalLogs: 0, totalWatched: 0 });
          setReviews([]);
          setFriendLogs([]);
          setAllLogs([]);
          setLoading(false);
          return;
        }

        const nextMovie = {
          ...resolved.movie,
          created_at: new Date().toISOString(),
        } as MovieDetails;

        setMovie(nextMovie);
        setWatchlistState("idle");
        setResolvedMoviePath(resolved.canonicalPath);

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
        console.error("Error fetching movie details:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMoviePage();

    return () => {
      cancelled = true;
    };
  }, [initialResolved, movieRouteParam, pathname, router, searchParamsString]);

  useEffect(() => {
    if (!movie) return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      void loadMovieLogData(movie.id, user?.id || "__guest__", movie).catch((error) => {
        if (!cancelled) {
          console.error("Error fetching movie activity:", error);
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [movie, user?.id]);

  const watchlistMovieId = movie?.id;
  const watchlistUserId = user?.id;
  useEffect(() => {
    if (!watchlistMovieId || !watchlistUserId) return;
    let cancelled = false;
    void getLogsForUser(watchlistUserId).then((logs) => {
      if (cancelled) return;
      const existing = logs.find((log) => log.content_type === "movie" && log.content_id === watchlistMovieId && log.watch_later);
      setWatchlistLogId(existing?.id || null);
      setCountdownState(existing?.countdown_date ? "shown" : "idle");
      setWatchlistState((current) => current === "saving" ? current : existing ? "saved" : "idle");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [watchlistMovieId, watchlistUserId]);

  useEffect(() => {
    if (!isScanLogFlow) {
      autoOpenScanLogRef.current = false;
      return;
    }

    if (loading || !movie || autoOpenScanLogRef.current) {
      return;
    }

    autoOpenScanLogRef.current = true;

    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowLogMovieModal(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isScanLogFlow, loading, movie, user]);

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

  const handleShareMovie = () => {
    if (!user || !movie) {
      requireLoginForAction();
      return;
    }

    router.push(`/share?movie_id=${movie.id}`);
  };

  const handleTrackMovie = async () => {
    if (!user || !movie) {
      requireLoginForAction();
      return;
    }
    if (watchlistState !== "idle") return;
    setWatchlistState("saving");
    try {
      const trackedLog = await addToWatchlist(user.id, movie.id, "movie", {
        title: movie.title,
        poster_url: movie.poster_url,
        release_date: movie.release_date,
      });
      setWatchlistLogId(trackedLog.id);
      setCountdownState(trackedLog.countdown_date ? "shown" : "idle");
      setWatchlistState("saved");
    } catch (error) {
      console.error("Could not add movie to watchlist:", error);
      setWatchlistState("idle");
      setBannerMessage("Could not save this movie. Try again.");
    }
  };

  const handleToggleCountdown = async () => {
    if (!watchlistLogId || !movie?.release_date) return;
    const nextState = countdownState === "shown" ? "idle" : "shown";
    setCountdownState("saving");
    try {
      await setWatchlistCountdown(watchlistLogId, nextState === "shown" ? movie.release_date : null);
      setCountdownState(nextState);
    } catch (error) {
      console.error("Could not update countdown:", error);
      setCountdownState(countdownState === "shown" ? "shown" : "idle");
      setBannerMessage("Could not update the countdown. Try again.");
    }
  };

  const movieMetaParts = useMemo(() => getMovieMetaParts(movie), [movie]);
  const heroImageUrl = movie?.backdrop_url || movie?.poster_url || null;
  const movieGenres = movie?.genres || [];
  const movieCountries = movie?.countries?.length ? movie.countries : movie?.country ? [movie.country] : [];
  const movieStudios = movie?.studios?.length ? movie.studios : movie?.production_companies?.map((company) => company.name).filter(Boolean) || [];
  const filmFacts = [
    { label: "Released", value: formatReleaseDate(movie?.release_date) },
    { label: "Runtime", value: formatRuntime(movie?.runtime) },
    { label: "Language", value: formatLanguage(movie?.language) },
    { label: "Countries", value: movieCountries.join(", ") },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
  const isUpcomingMovie = Boolean(movie?.release_date && movie.release_date > new Date().toISOString().slice(0, 10));
  const castPeople = useMemo(() => movie?.cast_details || [], [movie]);
  const visibleCastPeople = showAllCast ? castPeople : castPeople.slice(0, 10);
  const crewBuckets = useMemo(() => getCrewBuckets(movie?.crew_details || []), [movie]);
  const directorNames = useMemo(() => {
    const creditedNames = (movie?.crew_details || [])
      .filter((person) => person.job === "Director")
      .map((person) => person.name.trim())
      .filter(Boolean);
    const uniqueNames = [...new Map(creditedNames.map((name) => [name.toLocaleLowerCase(), name])).values()];
    return uniqueNames.length ? uniqueNames : movie?.director ? [movie.director] : [];
  }, [movie]);
  const movieReviewsHref = movie
    ? `${resolvedMoviePath || `/movie/${movie.id}`}/reviews`
    : "/all-movies";
  const myReviewLog = useMemo(() => {
    if (allLogs.length === 0) return null;

    return [...allLogs].sort((a, b) => {
      const watchedDiff = new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
      if (watchedDiff !== 0) return watchedDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0] || null;
    }, [allLogs]);
  const seenByCircleLogs = useMemo(() => {
    const entries = new Map<string, MovieLogWithContent>();
    friendLogs.forEach((log) => {
      if (log.user_id !== user?.id) entries.set(log.id, log);
    });
    return [...entries.values()].sort((a, b) =>
      new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime()
    );
  }, [friendLogs, user?.id]);
  const ratingCategories = [
    { label: "Bad", key: "bad", count: reactionBreakdown.bad, color: "#595959", text: "text-[#777]" },
    { label: "Average", key: "average", count: reactionBreakdown.average, color: "#918a7c", text: "text-[#a49d90]" },
    { label: "Good", key: "good", count: reactionBreakdown.good, color: "#f5f0de", text: "text-[#f5f0de]" },
    { label: "Masterpiece", key: "masterpiece", count: reactionBreakdown.masterpiece, color: "#ff7a1a", text: "text-[#ff7a1a]" },
  ];
  const ratedCount = ratingCategories.reduce((total, category) => total + category.count, 0);
  const ratingSegmentCount = 40;
  const ratingSegments = ratingCategories.map((category) => ({
    ...category,
    segments: ratedCount ? Math.floor((category.count / ratedCount) * ratingSegmentCount) : 0,
    percentage: ratedCount ? Math.round((category.count / ratedCount) * 100) : 0,
  }));
  if (ratedCount > 0) {
    const remainingSegments = ratingSegmentCount - ratingSegments.reduce((total, category) => total + category.segments, 0);
    const byRemainder = ratingCategories.map((category, index) => ({
      index,
      remainder: ((category.count / ratedCount) * ratingSegmentCount) % 1,
    })).sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; index < remainingSegments; index += 1) {
      ratingSegments[byRemainder[index % byRemainder.length].index].segments += 1;
    }
  }

  const renderCastRow = (person: MovieCreditPerson) => (
    <Link
      key={person.id}
      href={buildCrewPath({ id: person.id, name: person.name })}
      className="flex min-w-0 items-center gap-3 py-2 text-left transition-colors hover:opacity-75"
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

  const renderCrewRow = (person: MovieCreditPerson, group: string) => (
    <Link
      key={`${group}-${person.id}-${person.name}`}
      href={buildCrewPath({ id: person.id, name: person.name })}
      className="flex min-w-0 items-center gap-3 py-2 text-left transition-colors hover:opacity-75"
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
          {person.job || person.department || group}
        </p>
      </div>
    </Link>
  );

  if (loading) {
    return null;
  }

  if (!movie) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="p-8 text-center">
          <p className="text-gray-600 text-lg">Movie not found</p>
          <Link href="/dashboard" className="text-[#f5f0de] mt-4 inline-block">
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
        <section className={heroImageUrl ? "relative overflow-hidden" : ""}>
          {heroImageUrl ? (
            <div className="relative h-[42svh] min-h-[300px] sm:h-[46svh] sm:min-h-[320px] lg:h-[48svh] lg:min-h-[340px]">
              <img loading="lazy"
                src={heroImageUrl}
                alt={`${movie.title} backdrop`}
                className="absolute inset-0 h-full w-full object-cover object-center"
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
            <div className={`mx-auto max-w-5xl px-4 pb-5 sm:px-6 sm:pb-7 lg:px-8 ${heroImageUrl ? "pt-5 sm:pt-6 lg:pt-8" : "pt-4 sm:pt-5 lg:pt-6"}`}>
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/45">
                  {movieMetaParts.map((part, index) => (
                    <span key={`${part}-${index}`}>{part}</span>
                  ))}
                </div>

                <h1
                  className="mt-4 text-[clamp(3rem,9vw,5.75rem)] font-black leading-[0.9] tracking-tight text-[#f5f0de]"
                  style={{ fontFamily: 'var(--font-playfair), "Playfair Display", serif' }}
                >
                  {movie.title}
                </h1>

                {movieGenres.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-[#ffb36b]">
                    {movieGenres.slice(0, 4).map((genre, index) => (
                      <span key={genre} className="inline-flex items-center">
                        {index > 0 && <span className="mr-2 text-white/30">,</span>}
                        <span>{genre}</span>
                      </span>
                    ))}
                  </div>
                )}

                {directorNames.length > 0 && (
                  <p className="mt-4 text-base text-white/58 sm:text-lg">
                    Directed by <span className="text-white/82">{directorNames.join(", ")}</span>
                  </p>
                )}

                <div className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    onClick={handleOpenLogModal}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ff7a1a] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#ff9847]"
                  >
                    Log
                  </button>
                  <button
                    onClick={handleShareMovie}
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
                  <button
                    type="button"
                    onClick={() => void handleTrackMovie()}
                    disabled={watchlistState !== "idle"}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#171717] px-4 text-sm font-medium text-[#f5f0de] transition-colors hover:border-white/30 hover:bg-[#222] disabled:opacity-50"
                  >
                    {watchlistState === "saved" ? <><Check className="h-4 w-4" strokeWidth={1.8} /> {isUpcomingMovie ? "Tracking" : "Saved"}</> : <><Bookmark className="h-4 w-4" strokeWidth={1.8} /> {watchlistState === "saving" ? "Saving" : isUpcomingMovie ? "Track" : "Watchlist"}</>}
                  </button>
                </div>
                {isUpcomingMovie ? <p className="mt-2 text-xs text-white/45">Track it for a release reminder and save it to your Watchlist.</p> : null}
                {isUpcomingMovie && watchlistState === "saved" && watchlistLogId ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-xs text-white/65">{countdownState === "shown" ? "Countdown is on your home screen." : "Show a countdown on your home screen?"}</p>
                    <button type="button" onClick={() => void handleToggleCountdown()} disabled={countdownState === "saving"} className="text-xs font-bold text-[#ff9b52] transition hover:text-[#ffc18f] disabled:opacity-50">
                      {countdownState === "saving" ? "Saving…" : countdownState === "shown" ? "Remove countdown" : "Show countdown"}
                    </button>
                  </div>
                ) : null}

                {movie.overview && (
                  <div className="mt-8">
                    <h2 className="text-xl font-black tracking-tight text-[#f5f0de] sm:text-2xl">Overview</h2>
                    <p className="mt-3 max-w-4xl text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
                      {movie.overview}
                    </p>
                  </div>
                )}

                <div className="mt-8 w-full text-center">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/45">
                    <span>Rating distribution</span>
                    <span>{reactionBreakdown.total} rating{reactionBreakdown.total === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${ratingSegmentCount}, minmax(0, 1fr))` }} role="img" aria-label={`Rating distribution across ${ratedCount} ratings`}>
                    {ratedCount > 0
                      ? ratingSegments.flatMap((category) => Array.from({ length: category.segments }, (_, index) => <span key={`${category.key}-${index}`} className="h-10 rounded-[2px] sm:h-14" style={{ backgroundColor: category.color }} />))
                      : Array.from({ length: ratingSegmentCount }, (_, index) => <span key={index} className="h-10 rounded-[2px] bg-white/10 sm:h-14" />)}
                  </div>
                  <div className="mt-5 grid grid-cols-4 gap-2 text-center sm:mt-6 sm:gap-4">
                    {ratingSegments.map((category) => <button key={category.key} type="button" onClick={() => setBannerMessage(`${category.count} ${category.label.toLowerCase()} rating${category.count === 1 ? "" : "s"}`)} className="min-w-0 text-center focus-visible:outline-2 focus-visible:outline-[#ff7a1a]">
                      <span className={`block text-xl font-black tabular-nums sm:text-3xl ${category.text}`}>{category.percentage}%</span>
                      <span className="mt-1 block truncate text-xs text-white/55 sm:mt-2 sm:text-base">{category.label}</span>
                    </button>)}
                  </div>
                  <DivideScoreDisplay counts={reactionBreakdown} />
                  {allLogs.length > 0 && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <button
                        className="flex w-full items-center justify-between text-left text-xs font-bold text-white/65 transition hover:text-[#f5f0de]"
                        onClick={() => setShowAllLogs((v) => !v)}
                        aria-expanded={showAllLogs}
                      >
                        <span>YOUR WATCH HISTORY <span className="ml-1 text-white/35">{allLogs.length}</span></span>
                        <span className="text-[#ff9b52]">{showAllLogs ? "Hide" : "See all logs"} {showAllLogs ? "−" : "+"}</span>
                      </button>
                      {showAllLogs && (
                        <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
                          {allLogs.map((log, index) => {
                            const label = getReactionLabelFromLogReaction(log.reaction);
                            const isLatest = log.id === myReviewLog?.id;
                            return (
                              <div key={log.id} className={`flex items-center gap-3 rounded-lg border px-3 py-3 sm:gap-4 ${isLatest ? "border-[#ff7a1a]/45 bg-[#ff7a1a]/[0.07]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                                <span className="w-8 shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/35">{isLatest ? "Latest" : `#${allLogs.length - index}`}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[#f5f0de]">{formatLogDate(log.watched_date)}</p>
                                  {log.notes?.trim() && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/55">{log.notes}</p>}
                                </div>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${getReactionBadgeClassFromLabel(label)}`}>{label}</span>
                                <button
                                  type="button"
                                  disabled={isLatest}
                                  className="shrink-0 text-xs font-bold text-[#ff9b52] transition hover:text-[#ffd0a6] disabled:cursor-default disabled:text-white/35"
                                  onClick={() => {
                                    setPendingLoadingTitle(movie?.title || log.content?.title);
                                    router.push(buildLogUrl(log));
                                  }}
                                >
                                  {isLatest ? "Here" : "Open →"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <Link
                        href={movieReviewsHref}
                        className="flex min-w-0 flex-col items-center text-center transition-colors hover:text-[#ffb36b]"
                      >
                        <span className="text-xs text-white/45">Reviews</span>
                        <span className="mt-1 text-lg font-black">{reviews.length}</span>
                      </Link>
                      <div className="flex min-w-0 flex-col items-center text-center">
                        <span className="text-xs text-white/45">Logs</span>
                        <span className="mt-1 text-lg font-black text-[#f5f0de]">{movieStats.totalLogs}</span>
                      </div>
                      <div className="flex min-w-0 flex-col items-center text-center">
                        <span className="text-xs text-white/45">Viewers</span>
                        <span className="mt-1 text-lg font-black text-[#f5f0de]">{movieStats.totalWatched}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-black">
          <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 space-y-6">
            {/* Logs from accounts you follow */}
            {seenByCircleLogs.length > 0 && (
              <section className="mx-auto w-full max-w-4xl">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-[#f5f0de]">Watched by</h3>
                  <span className="text-xs text-white/40">{seenByCircleLogs.length} watched</span>
                </div>
                <div className="-mx-4 mt-4 grid auto-cols-[calc(25%_-_6px)] grid-flow-col snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                  {seenByCircleLogs.slice(0, 10).map((log) => {
                    const label = getReactionLabelFromLogReaction(log.reaction);
                    const isYou = log.user_id === user?.id;
                    const userLabel = isYou ? "You" : getDisplayUserLabel(log.user);
                    return (
                      <button
                        key={log.id}
                        type="button"
                        className={`group flex min-h-[112px] min-w-0 snap-start flex-col items-center rounded-lg border p-2.5 text-center transition duration-200 sm:min-h-40 sm:items-stretch sm:rounded-2xl sm:p-4 sm:text-left sm:hover:-translate-y-1 ${isYou ? "border-[#ff7a1a] bg-[#ff7a1a] text-black shadow-[0_10px_30px_rgba(255,122,26,0.12)]" : "border-white/10 bg-[#151515] text-[#f5f0de] hover:border-[#ff7a1a]/55"}`}
                        onClick={() => {
                          setPendingLoadingTitle(movie?.title || log.content?.title);
                          router.push(buildLogUrl(log));
                        }}
                        title={`View ${userLabel}'s log`}
                      >
                        <span className="flex min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs sm:h-10 sm:w-10 sm:text-base ${isYou ? "bg-black/15 text-black" : "bg-[#f5f0de] text-black"}`}>
                            {log.user.avatar_url ? (
                              <img loading="lazy"
                                src={log.user.avatar_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              userLabel.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className={`w-full truncate text-[11px] font-semibold leading-tight sm:text-base ${isYou ? "text-black" : "text-[#f5f0de]"}`}>{userLabel}</span>
                        </span>
                        <span className={`mt-3 break-words text-[10px] font-bold leading-tight sm:mt-5 sm:text-sm ${isYou ? "text-black" : "text-[#ff9b52]"}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <WatchProviders regions={movie.watch_providers} />

            <div>
              <div className="flex items-center justify-center gap-4 text-sm font-black uppercase tracking-[0.16em] text-white/55 sm:text-base sm:tracking-[0.2em]">
                {(["cast", "crew", "details", "reviews"] as MovieDetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveDetailTab(tab)}
                    className={`border-b-2 px-2 py-2 transition sm:px-3 ${
                      activeDetailTab === tab
                        ? "border-[#ff8a1e] text-[#ffb36b]"
                        : "border-transparent hover:border-white/20 hover:text-white/70"
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
                      <div className="space-y-3">
                        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                          {visibleCastPeople.map(renderCastRow)}
                        </div>
                        {castPeople.length > 10 && (
                          <button
                            type="button"
                            onClick={() => setShowAllCast((value) => !value)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[#ffb36b] hover:text-[#ffcf9b]"
                          >
                            {showAllCast ? "Show less" : `Show all (${castPeople.length})`}
                            <ChevronDown className={`h-4 w-4 transition ${showAllCast ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">No cast data available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "crew" && (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">Crew</h2>
                      <p className="text-sm text-white/45">
                        Directors, producers, cinematography, editing, and music
                      </p>
                    </div>
                    {crewBuckets.length > 0 ? (
                      <div className="space-y-5">
                        {crewBuckets.map(([group, people]) => (
                          <div key={group} className="space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/45">{group}</p>
                            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                              {people.map((person) => renderCrewRow(person, group))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/60">No crew credits available.</p>
                    )}
                  </section>
                )}

                {activeDetailTab === "details" && (
                  <section className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
                    <div>
                      <h2 className="text-2xl font-bold">Film details</h2>
                      <dl className="mt-5 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-4 text-sm">
                        {filmFacts.map((fact) => (
                          <div key={fact.label} className="col-span-2 grid grid-cols-subgrid">
                            <dt className="text-white/45">{fact.label}</dt>
                            <dd className="text-[#f5f0de]">{fact.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {movie.trailer_key && (
                        <a
                          href={`https://www.youtube.com/watch?v=${encodeURIComponent(movie.trailer_key)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-6 inline-block text-sm font-semibold text-[#ffb36b] hover:underline"
                        >
                          Watch trailer ↗
                        </a>
                      )}
                    </div>

                    <div className="space-y-6">
                      {movieGenres.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/50">Genres</h3>
                          <p className="mt-2 text-sm leading-6 text-[#f5f0de]">{movieGenres.join(" · ")}</p>
                        </div>
                      )}
                      {movieStudios.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/50">Studios</h3>
                          <p className="mt-2 text-sm leading-6 text-[#f5f0de]">{movieStudios.join(" · ")}</p>
                        </div>
                      )}
                      {Boolean(movie.keywords?.length) && (
                        <div>
                          <h3 className="text-sm font-semibold text-white/50">Themes</h3>
                          <p className="mt-2 text-sm leading-6 text-[#f5f0de]">{movie.keywords?.slice(0, 16).join(" · ")}</p>
                        </div>
                      )}
                    </div>

                    {Boolean(movie.backdrop_gallery_urls?.length) && (
                      <div className="lg:col-span-2">
                        <h3 className="text-sm font-semibold text-white/50">Stills</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {movie.backdrop_gallery_urls?.filter((url) => url !== heroImageUrl).slice(0, 3).map((url) => (
                            <img key={url} src={url} alt={`Scene from ${movie.title}`} className="aspect-video w-full object-cover" loading="lazy" />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {activeDetailTab === "reviews" && (
                  <section className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold">Reviews</h2>
                      <Link
                        href={movieReviewsHref}
                        className="text-sm font-semibold text-[#ffb36b] transition hover:text-[#ffcf9b]"
                      >
                        Open all reviews
                      </Link>
                    </div>
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

      {/* Add to List Modal */}
      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        content={movie as Content}
        user={user}
      />

      {/* Log Movie Modal */}
      <LogMovieModal
        isOpen={showLogMovieModal}
        onClose={() => setShowLogMovieModal(false)}
        content={movie as Content}
        user={user}
        onLogCreated={(message) => {
          if (isScanLogFlow) {
            setShowScanThanksModal(true);
          } else {
            setBannerMessage(message);
          }
          if (!user || !movie) return;
          void loadMovieLogData(movie.id, user.id, movie);
        }}
      />

      {showScanThanksModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#0c0c0c] px-5 py-6 text-center text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#ff8a1e]/25 bg-[#ff8a1e]/10 text-[#ffb36b]">
              <LogsIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-2xl font-black tracking-tight">Thanks for submitting your review.</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              Your log is saved. Explore Canisterr for more movies, reviews, and logs.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowScanThanksModal(false);
                router.push("/dashboard");
              }}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#ff8a1e] px-5 py-3 text-sm font-black text-black transition-transform hover:translate-y-[-1px]"
            >
              Explore Canisterr
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
