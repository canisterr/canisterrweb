"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { ArrowLeft, Filter, X, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import LogFeedCard from "@/components/LogFeedCard";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getLogsForContent, getVisibleLogNotes } from "@/lib/logs";
import { Movie, MovieLogWithContent, MovieReactionValue, User } from "@/types";
import { getLogEngagementBatch, type LogEngagementSnapshot } from "@/lib/log-engagement";
import { resolveMovieRouteParam } from "@/lib/content-slugs";

type ScopeFilter = "all" | "friends";
type SortFilter = "recent" | "oldest" | "rating";
type RatingFilter = "all" | "bad" | "average" | "good" | "masterpiece";

const REVIEW_FETCH_LIMIT = 1000;

function getRatingGroup(reaction: MovieReactionValue | null | undefined): Exclude<RatingFilter, "all"> {
  if (reaction === 2) return "masterpiece";
  if (reaction === 1) return "good";
  if (reaction === 1.5) return "average";
  return "bad";
}

export default function MovieReviewsPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const movieRouteParam = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const searchParamsString = searchParams.toString();
  const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

  const [user, setUser] = useState<User | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [moviePath, setMoviePath] = useState<string | null>(null);
  const [reviews, setReviews] = useState<MovieLogWithContent[]>([]);
  const [reviewsEngagement, setReviewsEngagement] = useState<Record<string, LogEngagementSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("recent");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setFriendIds([]);
        return;
      }

      try {
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

        const followsRef = ref(db, "follows");
        const followsSnapshot = await get(followsRef);
        if (followsSnapshot.exists()) {
          const allFollows = followsSnapshot.val();
          const acceptedFriendIds = new Set<string>();

          Object.values(allFollows).forEach((follow: any) => {
            if (follow.status !== "accepted") return;
            if (follow.follower_id === currentUser.id) acceptedFriendIds.add(follow.following_id);
            if (follow.following_id === currentUser.id) acceptedFriendIds.add(follow.follower_id);
          });

          setFriendIds(Array.from(acceptedFriendIds));
        } else {
          setFriendIds([]);
        }

      } catch (error) {
        console.error("Error loading review auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMovieReviewsPage = async () => {
      try {
        setLoading(true);
        const resolved = await resolveMovieRouteParam(movieRouteParam);

        if (cancelled) return;

        if (!resolved) {
          setMovie(null);
          setMoviePath(null);
          setReviews([]);
          setLoading(false);
          return;
        }

        const contentLogs = await getLogsForContent(resolved.movie.id, "movie", REVIEW_FETCH_LIMIT);
        const reviewFeed = contentLogs.filter((log) => getVisibleLogNotes(log).trim().length > 0);

        if (cancelled) return;

        setMovie({ ...resolved.movie, created_at: new Date().toISOString() } as Movie);
        setMoviePath(resolved.canonicalPath);
        setReviews(reviewFeed);

        if (pathname !== `${resolved.canonicalPath}/reviews`) {
          const nextUrl = searchParamsString
            ? `${resolved.canonicalPath}/reviews?${searchParamsString}`
            : `${resolved.canonicalPath}/reviews`;
          router.replace(nextUrl);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading movie reviews page:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMovieReviewsPage();

    return () => {
      cancelled = true;
    };
  }, [movieRouteParam, pathname, router, searchParamsString]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const filteredReviews = useMemo(() => {
    const friendSet = new Set(friendIds);

    const filtered = reviews.filter((review) => {
      if (scopeFilter === "friends" && !friendSet.has(review.user_id)) {
        return false;
      }

      if (ratingFilter !== "all" && getRatingGroup(review.reaction) !== ratingFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortFilter === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortFilter === "rating") {
        if (b.reaction !== a.reaction) return (b.reaction ?? -1) - (a.reaction ?? -1);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [friendIds, ratingFilter, reviews, scopeFilter, sortFilter]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const engagement = await getLogEngagementBatch(
        reviews.map((review) => review.id),
        user?.id
      );
      if (!cancelled) setReviewsEngagement(engagement);
    })();

    return () => {
      cancelled = true;
    };
  }, [reviews, user?.id]);

  if (loading) {
    return null;
  }

  const filterButtonClass = (active: boolean) =>
    `inline-flex items-center justify-center gap-2 rounded-none border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
      active
        ? "border border-[#ff8a1e]/30 bg-[#ff8a1e] text-black"
        : "border border-white/10 bg-white/5 text-white/70 hover:border-[#ff8a1e]/25 hover:bg-[#ff8a1e]/10 hover:text-white"
    }`;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={moviePath || "/all-movies"}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Movie
            </Link>
          </div>

          <div className="pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8a1e]">
              Reviews
            </p>
            <h1 className="mt-3 text-3xl font-black leading-none tracking-tight text-[#f5f0de] sm:text-5xl">
              {movie?.title || "Movie"} Reviews
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              {filteredReviews.length} review{filteredReviews.length === 1 ? "" : "s"} shown.
            </p>

            <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-white"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
          </div>

          <div className="mt-6">
            {filteredReviews.length > 0 ? (
              <div className="grid gap-4">
                {filteredReviews.map((review) => (
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
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-white/60">No reviews match these filters.</p>
                <p className="mt-2 text-xs text-white/40">
                  Try switching to All, widening the rating filter, or opening Recent.
                </p>
              </div>
            )}
          </div>
        </div>

        {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="w-full max-w-md rounded-none border border-white/10 bg-[#0f0f0f] p-4 text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/80">Filters</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight">Refine reviews</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="rounded-none border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Scope</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={filterButtonClass(scopeFilter === "all")}
                      onClick={() => setScopeFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(scopeFilter === "friends")}
                      onClick={() => setScopeFilter("friends")}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Friends
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Sort</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "recent")}
                      onClick={() => setSortFilter("recent")}
                    >
                      Recent
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "oldest")}
                      onClick={() => setSortFilter("oldest")}
                    >
                      Oldest
                    </button>
                    <button
                      type="button"
                      className={filterButtonClass(sortFilter === "rating")}
                      onClick={() => setSortFilter("rating")}
                    >
                      Rating
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Rating</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["all", "All"],
                      ["bad", "Bad"],
                      ["average", "Average"],
                      ["good", "Good"],
                      ["masterpiece", "Masterpiece"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={filterButtonClass(ratingFilter === value)}
                        onClick={() => setRatingFilter(value as RatingFilter)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setScopeFilter("all");
                    setSortFilter("recent");
                    setRatingFilter("all");
                  }}
                  className="text-sm font-semibold text-white/55 transition hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="rounded-none bg-[#ff8a1e] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff9a3d]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
