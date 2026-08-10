"use client";

import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useStoreScene } from "@/lib/store/store-state";
import { useEscapeKey } from "@/hooks/store/useEscapeKey";
import { searchMovies, searchPeople, getPersonCombinedCredits } from "@/lib/tmdb";
import { getShelfPosterUrl } from "@/lib/store/discover";
import { GENRE_SECTIONS, COLLECTION_SECTIONS } from "@/lib/store/shelf-config";
import { PERSONALIZED_SECTIONS } from "@/lib/store/personalized-config";
import { getSectionAnchor, getSectionStandPoint } from "@/lib/store/layout";
import { trackStoreEvent } from "@/lib/store/analytics";
import type { StoreMovieSummary } from "@/types/store";
import type { TMDBPersonSearchResult } from "@/types";

const JUMP_TARGETS = [...PERSONALIZED_SECTIONS, ...COLLECTION_SECTIONS, ...GENRE_SECTIONS];
const SEARCH_DEBOUNCE_MS = 320;
const MIN_QUERY_LENGTH = 2;

interface RawMovieLike {
  id: number;
  title?: string;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
}

function toSummary(movie: RawMovieLike): StoreMovieSummary {
  const year = movie.release_date ? Number.parseInt(movie.release_date.slice(0, 4), 10) : null;
  return {
    id: movie.id,
    title: movie.title || "Untitled",
    posterPath: movie.poster_path ?? null,
    releaseYear: Number.isFinite(year) ? year : null,
    rating: movie.vote_average ?? null,
  };
}

/** Store-wide search: movie title, actor/director (via combined credits), and jump-to for genres/collections. */
export default function StoreSearch() {
  const isOpen = useStoreScene((s) => s.isSearchOpen);
  const closeSearch = useStoreScene((s) => s.closeSearch);
  const selectMovie = useStoreScene((s) => s.selectMovie);
  const requestTeleport = useStoreScene((s) => s.requestTeleport);

  const [query, setQuery] = useState("");
  const [movieResults, setMovieResults] = useState<StoreMovieSummary[]>([]);
  const [peopleResults, setPeopleResults] = useState<TMDBPersonSearchResult[]>([]);
  const [activePerson, setActivePerson] = useState<TMDBPersonSearchResult | null>(null);
  const [pending, setPending] = useState(false);

  useEscapeKey(closeSearch, isOpen);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setMovieResults([]);
      setPeopleResults([]);
      setActivePerson(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setMovieResults([]);
      setPeopleResults([]);
      return;
    }

    setActivePerson(null);
    setPending(true);
    const timer = setTimeout(async () => {
      try {
        const [movies, people] = await Promise.all([searchMovies(trimmed, 1), searchPeople(trimmed)]);
        setMovieResults(movies.slice(0, 9).map(toSummary));
        setPeopleResults(people.slice(0, 4));
        trackStoreEvent("store_search", { query_length: trimmed.length });
      } catch (error) {
        console.error("Store search error:", error);
      } finally {
        setPending(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const jumpMatches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < MIN_QUERY_LENGTH) return [];
    return JUMP_TARGETS.filter((target) => target.label.toLowerCase().includes(trimmed)).slice(0, 6);
  }, [query]);

  if (!isOpen) return null;

  const handlePersonClick = async (person: TMDBPersonSearchResult) => {
    setActivePerson(person);
    setPeopleResults([]);
    setPending(true);
    try {
      const credits = await getPersonCombinedCredits(person.id);
      const movies = (credits?.cast || [])
        .filter((credit) => credit.media_type === "movie" && credit.title)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 12)
        .map(toSummary);
      setMovieResults(movies);
    } catch (error) {
      console.error("Store person credits error:", error);
    } finally {
      setPending(false);
    }
  };

  const handleMovieClick = (movieId: number) => {
    selectMovie(movieId);
    closeSearch();
  };

  const handleJumpClick = (sectionId: string) => {
    const anchor = getSectionAnchor(sectionId);
    if (!anchor) return;
    requestTeleport(getSectionStandPoint(anchor), sectionId, false);
    closeSearch();
  };

  const hasNoResults =
    !pending && query.trim().length >= MIN_QUERY_LENGTH && movieResults.length === 0 && peopleResults.length === 0 && jumpMatches.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the store"
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c0c] shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <SearchIcon className="h-4 w-4 text-[#ff9a52]" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies, actors, directors, genres…"
            aria-label="Search query"
            className="flex-1 bg-transparent text-sm text-[#f5f0de] placeholder:text-[#f5f0de]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#f5f0de]/60 transition hover:text-[#f5f0de]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activePerson && (
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#ff9a52]">Movies with {activePerson.name}</p>
          )}

          {peopleResults.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/50">People</h3>
              <div className="flex flex-wrap gap-2">
                {peopleResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handlePersonClick(person)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {jumpMatches.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/50">Jump To</h3>
              <div className="flex flex-wrap gap-2">
                {jumpMatches.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleJumpClick(section.id)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {movieResults.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#f5f0de]/50">Movies</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {movieResults.map((movie) => {
                  const posterUrl = movie.posterPath ? getShelfPosterUrl(movie, "w185") : null;
                  return (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => handleMovieClick(movie.id)}
                      className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition hover:border-[#ff7a1a]/50"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[#1a1a1a]">
                        {posterUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#f5f0de]">{movie.title}</p>
                        {movie.releaseYear && <p className="text-xs text-[#f5f0de]/50">{movie.releaseYear}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasNoResults && <p className="py-8 text-center text-sm text-[#f5f0de]/50">No matches for &ldquo;{query}&rdquo;</p>}
        </div>
      </div>
    </div>
  );
}
