"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Film, Play, Star, Users, X } from "lucide-react";
import { getMovieDetails, getSimilarMovies } from "@/lib/tmdb";
import { buildMoviePath } from "@/lib/content-slugs";
import { addToWatchlist } from "@/lib/logs";
import { getFriendsWhoWatched, type FriendWatchEntry } from "@/lib/store/social";
import { useStoreScene } from "@/lib/store/store-state";
import { useEscapeKey } from "@/hooks/store/useEscapeKey";
import { trackStoreEvent } from "@/lib/store/analytics";
import LogMovieModal from "@/components/LogMovieModal";
import type { Content, User } from "@/types";

type MovieDetails = NonNullable<Awaited<ReturnType<typeof getMovieDetails>>>;
type SimilarMovie = Awaited<ReturnType<typeof getSimilarMovies>>[number];

const REACTION_LABEL: Record<number, string> = { 0: "Bad", 1: "Good", 1.5: "Average", 2: "Masterpiece" };

interface MoviePreviewProps {
  user: User | null;
}

/** Thin subscriber: remounts the panel (via key) on every movie change so its internal state always starts fresh. */
export default function MoviePreview({ user }: MoviePreviewProps) {
  const movieId = useStoreScene((s) => s.selectedMovieId);
  const selectMovie = useStoreScene((s) => s.selectMovie);

  if (movieId === null) return null;

  return <MoviePreviewPanel key={movieId} movieId={movieId} user={user} onClose={() => selectMovie(null)} onSelectMovie={selectMovie} />;
}

interface MoviePreviewPanelProps {
  movieId: number;
  user: User | null;
  onClose: () => void;
  onSelectMovie: (movieId: number) => void;
}

function MoviePreviewPanel({ movieId, user, onClose, onSelectMovie }: MoviePreviewPanelProps) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [similar, setSimilar] = useState<SimilarMovie[]>([]);
  const [friends, setFriends] = useState<FriendWatchEntry[]>([]);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [watchlistState, setWatchlistState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEscapeKey(onClose);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [movieDetails, similarMovies] = await Promise.all([
        getMovieDetails(movieId).catch(() => null),
        getSimilarMovies(movieId).catch(() => []),
      ]);
      if (cancelled) return;
      setDetails(movieDetails);
      setSimilar(similarMovies);
      trackStoreEvent("movie_selected_from_store", { movie_id: movieId });

      if (user) {
        getFriendsWhoWatched(user.id, movieId)
          .then((entries) => {
            if (!cancelled) setFriends(entries);
          })
          .catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [movieId, user]);

  const handleAddToWatchlist = async () => {
    if (!user) return;
    setWatchlistState("saving");
    try {
      await addToWatchlist(user.id, movieId, "movie");
      setWatchlistState("saved");
      trackStoreEvent("store_watchlist_added", { movie_id: movieId });
    } catch (error) {
      console.error("Store add to watchlist error:", error);
      setWatchlistState("error");
    }
  };

  const logModalContent: Content | null = details ? { ...details, created_at: new Date().toISOString(), type: "movie" } : null;
  const year = details?.release_date ? details.release_date.slice(0, 4) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={details ? details.title : "Movie details"}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-[#0c0c0c] shadow-[0_32px_120px_rgba(0,0,0,0.65)] sm:rounded-[1.75rem]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close movie details"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {!details ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#ff7a1a]" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row">
              <div className="relative aspect-[2/3] w-full shrink-0 bg-[#161616] sm:w-64">
                {details.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={details.poster_url} alt={details.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[#f5f0de]/40">No poster</div>
                )}
              </div>

              <div className="flex-1 space-y-4 p-5 sm:p-6">
                <div>
                  <h2 className="pr-8 text-2xl font-black leading-tight text-[#f5f0de]">{details.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#f5f0de]/60">
                    {year && <span>{year}</span>}
                    {details.runtime ? <span>{details.runtime} min</span> : null}
                    {typeof details.rating === "number" && (
                      <span className="flex items-center gap-1 text-[#ffb36b]">
                        <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        {details.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {details.genres && details.genres.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {details.genres.map((genre) => (
                        <span key={genre} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-[#f5f0de]/70">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {details.overview && <p className="text-sm leading-6 text-[#f5f0de]/75">{details.overview}</p>}

                {details.cast_details && details.cast_details.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/45">Cast</p>
                    <p className="text-sm text-[#f5f0de]/70">
                      {details.cast_details
                        .slice(0, 5)
                        .map((c) => c.name)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {friends.length > 0 && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/45">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      Friends
                    </p>
                    <p className="text-sm text-[#f5f0de]/70">
                      {friends
                        .slice(0, 4)
                        .map(
                          (entry) =>
                            `${entry.user.name}${entry.reaction !== null && entry.reaction !== undefined ? ` (${REACTION_LABEL[entry.reaction]})` : ""}`
                        )
                        .join(", ")}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {details.trailer_key && (
                    <button
                      type="button"
                      onClick={() => setShowTrailer(true)}
                      className="flex items-center gap-1.5 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      Trailer
                    </button>
                  )}
                  {user ? (
                    <button
                      type="button"
                      onClick={handleAddToWatchlist}
                      disabled={watchlistState === "saving" || watchlistState === "saved"}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50 disabled:opacity-70"
                    >
                      {watchlistState === "saved" ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Added
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Watchlist
                        </>
                      )}
                    </button>
                  ) : null}
                  {user ? (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
                    >
                      <Film className="h-3.5 w-3.5" aria-hidden="true" /> Rate / Mark Watched
                    </button>
                  ) : (
                    <Link
                      href="/auth/login?redirect=/store"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
                    >
                      Sign in for actions
                    </Link>
                  )}
                  <Link
                    href={buildMoviePath({
                      id: details.id,
                      title: details.title,
                      director: details.director,
                      language: details.language ?? null,
                      release_date: details.release_date,
                    })}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
                  >
                    Full Details
                  </Link>
                </div>

                {similar.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/45">Similar Movies</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {similar.slice(0, 8).map((movie) => (
                        <button
                          key={movie.id}
                          type="button"
                          onClick={() => onSelectMovie(movie.id)}
                          className="w-16 shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a] transition hover:ring-2 hover:ring-[#ff7a1a]/60"
                        >
                          {movie.poster_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={movie.poster_url} alt={movie.title} className="aspect-[2/3] w-full object-cover" />
                          ) : (
                            <div className="flex aspect-[2/3] w-full items-center justify-center p-1 text-center text-[9px] text-[#f5f0de]/50">
                              {movie.title}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showTrailer && details?.trailer_key && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Trailer"
          onClick={() => setShowTrailer(false)}
        >
          <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl" onClick={(event) => event.stopPropagation()}>
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${details.trailer_key}?autoplay=1`}
              title="Trailer"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {showLogModal && user && logModalContent && (
        <LogMovieModal isOpen={showLogModal} onClose={() => setShowLogModal(false)} content={logModalContent} user={user} />
      )}
    </div>
  );
}
