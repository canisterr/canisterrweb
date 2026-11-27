"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { signOut as authSignOut } from "@/lib/auth";
import { getTasteRecommendations, getTMDBImageUrl, searchMovies, type TasteRecommendation } from "@/lib/tmdb";
import { getTmdbLookupId, searchShows } from "@/lib/tvmaze";
import {
  addToUserTaste,
  getUserTasteProfile,
  removeFromUserTaste,
} from "@/lib/user-taste";
import { User, UserTasteWithContent } from "@/types";
import styles from "./taste.module.css";

export default function TastePage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tastes, setTastes] = useState<UserTasteWithContent[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<TasteRecommendation[]>([]);
  const [recommendationHeading, setRecommendationHeading] = useState("Top rated movies");
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedAdded, setSelectedAdded] = useState<TasteRecommendation | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [similarRecommendations, setSimilarRecommendations] = useState<TasteRecommendation[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [searching, setSearching] = useState(false);
  const [contentType, setContentType] = useState<"movie" | "tv">("movie");
  const [addingContent, setAddingContent] = useState<string | null>(null);
  const [removingContent, setRemovingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);
  const similarRequestId = useRef(0);
  const tasteRecords = useRef(tastes);
  tasteRecords.current = tastes;


  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) {
      router.push("/auth/login");
      return;
    }

    let cancelled = false;

    const loadTasteProfile = async () => {
      try {
        setUser(sessionUser);
        console.log("TastePage: Fetching taste profile for:", sessionUser.id);
        const userTastes = await getUserTasteProfile(sessionUser.id);
        if (cancelled) return;
        console.log("TastePage: Taste profile fetched:", userTastes.length, "items");
        setTastes(userTastes);
        try {
          const savedSelection = window.sessionStorage.getItem(`taste-last-added:${sessionUser.id}`);
          if (savedSelection) {
            const parsed = JSON.parse(savedSelection) as { type?: string; id?: number };
            const exists = userTastes.some((taste) => taste.content_type === parsed.type && taste.content_id === parsed.id);
            if (exists && parsed.type && parsed.id) setLastAddedKey(`${parsed.type}:${parsed.id}`);
          }
        } catch { /* Keep the page usable if browser storage is unavailable. */ }
        setError(null);
      } catch (error) {
        console.error("TastePage: Error loading taste profile:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load taste profile"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTasteProfile();

    return () => {
      cancelled = true;
    };
  }, [router, sessionLoading, sessionUser]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSearch = async (query: string) => {
    const requestId = ++searchRequestId.current;
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      console.log("TastePage: Searching for", contentType, ":", query);
      let results: any[] = [];

      if (contentType === "movie") {
        results = await searchMovies(query);
      } else {
        results = await searchShows(query);
      }

      console.log("TastePage: Search returned", results.length, "results");
      
      // Add smart suggestions based on existing taste movies
      const suggestedResults = addSmartSuggestions(results);
      if (requestId === searchRequestId.current) setSearchResults(suggestedResults.slice(0, 15));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Search failed";
      console.error("TastePage: Search error:", error);
      if (requestId === searchRequestId.current) setError("Search error: " + errorMessage);
    } finally {
      if (requestId === searchRequestId.current) setSearching(false);
    }
  };

  const addSmartSuggestions = (searchResults: any[]) => {
    if (tastes.length === 0) return searchResults;
    const normalizeGenre = (genre: unknown) => {
      if (typeof genre === "string") return genre.trim().toLowerCase();
      if (genre && typeof genre === "object" && "name" in genre) {
        return String((genre as { name?: unknown }).name || "").trim().toLowerCase();
      }
      return "";
    };

    // Extract directors and genres from existing taste
    const existingDirectors = new Set<string>();
    const existingGenres = new Set<string>();

    tastes.forEach((taste) => {
      if (taste.content && typeof taste.content === "object") {
        const content = taste.content as any;
        if (content.director) existingDirectors.add(content.director.toLowerCase());
        if (Array.isArray(content.genres)) {
          content.genres.forEach((genre: unknown) => {
            const normalized = normalizeGenre(genre);
            if (normalized) existingGenres.add(normalized);
          });
        }
      }
    });

    // Score each result based on similarity
    const scoredResults = searchResults.map((result) => {
      let score = 0;
      const resultDirector = (result.director || result.director_name || "").toLowerCase();
      const resultGenres = Array.isArray(result.genres)
        ? result.genres.map(normalizeGenre).filter(Boolean)
        : [];

      // Director match = +50 points
      if (resultDirector && existingDirectors.has(resultDirector)) {
        score += 50;
      }

      // Genre matches = +10 points each
      resultGenres.forEach((genre: string) => {
        if (existingGenres.has(genre)) score += 10;
      });

      return { ...result, _suggestionScore: score };
    });

    // Sort by suggestion score (highest first), then by original order
    return scoredResults.sort((a, b) => (b._suggestionScore || 0) - (a._suggestionScore || 0));
  };

  const handleAddToTaste = async (contentId: number) => {
    if (!user) return;

    try {
      setAddingContent(`${contentType}-${contentId}`);
      setError(null);
      console.log("TastePage: Adding", contentType, "to taste:", contentId);
      const result = [...searchResults, ...recommendations, ...similarRecommendations].find((item) => item.id === contentId);
      const addedTaste = await addToUserTaste(user.id, contentId, contentType);
      if (result) {
        const title = result.title || result.name || "Untitled";
        const posterUrl = result.poster_url || (result.poster_path ? getTMDBImageUrl(result.poster_path, "w300") : null);
        const content = {
          ...result,
          id: contentId,
          title,
          type: contentType,
          poster_url: posterUrl,
        };
        setTastes((current) => [{ ...addedTaste, content } as UserTasteWithContent, ...current]);
        const addedKey = `${contentType}:${contentId}`;
        setLastAddedKey(addedKey);
        try {
          window.sessionStorage.setItem(`taste-last-added:${user.id}`, JSON.stringify({ type: contentType, id: contentId }));
        } catch { /* The outline still works for the current page session. */ }
        const selected: TasteRecommendation = {
          id: contentId,
          ...(contentType === "tv" && result.tmdb_id ? { tmdb_id: result.tmdb_id } : {}),
          title,
          poster_url: posterUrl,
          release_date: result.release_date || result.first_air_date || null,
          overview: result.overview || null,
          genres: Array.isArray(result.genres) ? result.genres.map((genre: any) => typeof genre === "string" ? genre : genre?.name).filter(Boolean) : [],
          type: contentType,
        };
        setSelectedAdded(selected);
        setSimilarRecommendations([]);
        setLoadingSimilar(true);
        const requestId = ++similarRequestId.current;
        const seedId = contentType === "movie" ? contentId : getTmdbLookupId(contentId, result.tmdb_id);
        if (seedId) {
          getTasteRecommendations(contentType, seedId)
            .then((items) => {
              if (requestId !== similarRequestId.current) return;
              const alreadyAdded = new Set<number>();
              tasteRecords.current.filter((taste) => taste.content_type === contentType).forEach((taste) => {
                alreadyAdded.add(taste.content_id);
                if (contentType === "tv") {
                  const tmdbId = getTmdbLookupId(taste.content_id, (taste.content as any)?.tmdb_id);
                  if (tmdbId) alreadyAdded.add(1_000_000_000 + tmdbId);
                }
              });
              alreadyAdded.add(contentId);
              const unique = items.filter((item) => !alreadyAdded.has(item.id));
              setSimilarRecommendations(unique.slice(0, 5));
            })
            .catch(() => {
              if (requestId === similarRequestId.current) setSimilarRecommendations([]);
            })
            .finally(() => {
              if (requestId === similarRequestId.current) setLoadingSimilar(false);
            });
        } else {
          setLoadingSimilar(false);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("TastePage: Error adding to taste:", error);
      setError("Failed to add to taste: " + errorMessage);
    } finally {
      setAddingContent(null);
    }
  };

  useEffect(() => {
    if (!showSearchModal || searchQuery.trim()) return;
    let cancelled = false;
    const sameTypeTastes = tasteRecords.current.filter((taste) => taste.content_type === contentType && taste.content);
    const seed = sameTypeTastes.find((taste) => taste.reaction === 2 || taste.reaction === 1) || sameTypeTastes[0];
    const seedId = seed
      ? contentType === "movie"
        ? seed.content_id
        : getTmdbLookupId(seed.content_id, (seed.content as any).tmdb_id)
      : null;
    setRecommendationHeading(seed && seedId
      ? `Because you like ${(seed.content as any).title || (seed.content as any).name || "this title"}`
      : contentType === "movie" ? "Top rated movies" : "Top rated shows");

    setLoadingRecommendations(true);
    setRecommendations([]);
    const getUnpicked = (items: TasteRecommendation[]) => {
      const alreadyPicked = new Set<number>();
      tasteRecords.current.filter((taste) => taste.content_type === contentType).forEach((taste) => {
        alreadyPicked.add(taste.content_id);
        if (contentType === "tv") {
          const tmdbId = getTmdbLookupId(taste.content_id, (taste.content as any)?.tmdb_id);
          if (tmdbId) alreadyPicked.add(1_000_000_000 + tmdbId);
        }
      });
      return addSmartSuggestions(items as any[])
        .filter((item) => !alreadyPicked.has(item.id))
        .slice(0, 16);
    };

    const loadRecommendations = async () => {
      let picks: TasteRecommendation[] = [];
      try {
        picks = await getTasteRecommendations(contentType, seedId);
      } catch {
        // A popular/top-rated fallback below keeps the sheet useful if similar titles fail.
      }
      let unpicked = getUnpicked(picks);
      if (seedId && unpicked.length === 0) {
        setRecommendationHeading(contentType === "movie" ? "Top rated movies" : "Top rated shows");
        try {
          picks = await getTasteRecommendations(contentType);
          unpicked = getUnpicked(picks);
        } catch {
          unpicked = [];
        }
      }
      if (!cancelled) setRecommendations(unpicked);
      if (!cancelled) setLoadingRecommendations(false);
    };
    void loadRecommendations();

    return () => { cancelled = true; };
  }, [showSearchModal, contentType]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const handleRemoveFromTaste = async (tasteId: string) => {
    try {
      setRemovingContent(tasteId);
      setError(null);
      console.log("TastePage: Removing taste:", tasteId);
      await removeFromUserTaste(tasteId);

      const removedTaste = tastes.find((taste) => taste.id === tasteId);
      if (removedTaste && lastAddedKey === `${removedTaste.content_type}:${removedTaste.content_id}`) {
        setLastAddedKey(null);
        if (user?.id) {
          try { window.sessionStorage.removeItem(`taste-last-added:${user.id}`); } catch { /* Ignore storage access errors. */ }
        }
      }
      setTastes((current) => current.filter((taste) => taste.id !== tasteId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("TastePage: Error removing from taste:", error);
      setError("Failed to remove from taste: " + errorMessage);
    } finally {
      setRemovingContent(null);
    }
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <PageLayout user={user || { id: "", username: "", name: "", avatar_url: null, created_at: "" }} onSignOut={handleSignOut}>
        <div className="p-4 sm:p-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Taste Profile</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return null;
  }

  const isTasteComplete = tastes.length >= 7;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="px-1 py-4 sm:p-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/profile"
            className="flex items-center gap-2 text-[#f5f0de] hover:text-[#f5f0de] mb-4 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">Your Taste</h1>
              <p className="text-gray-600">
                {isTasteComplete
                  ? `You have ${tastes.length} movies in your taste profile`
                  : `Add at least 7 movies to complete your profile (${tastes.length}/7)`}
              </p>
            </div>

            <button
              onClick={() => setShowSearchModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Add Movie
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Profile Completion</span>
            <span className="text-sm font-medium text-gray-700">
              {tastes.length}/7 minimum
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isTasteComplete ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min((tastes.length / 7) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Taste Movies Grid */}
        {tastes.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {tastes.filter((taste) => taste.content && taste.content.title).map((taste) => (
              <div key={taste.id} className="flex flex-col">
                <div className={`relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md transition-shadow mb-3 group ${lastAddedKey === `${taste.content_type}:${taste.content_id}` ? "border-2 border-[#ff7a18]" : "border border-transparent"}`}>
                  <img
                    src={taste.content?.poster_url || ""}
                    alt={taste.content?.title || "Movie"}
                    className="w-full h-full object-cover"
                  />

                  {/* Hover overlay with delete button */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleRemoveFromTaste(taste.id)}
                      disabled={removingContent === taste.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                      title="Remove from taste"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* TV Badge */}
                  {taste.content?.type === "tv" && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">
                      TV
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center sm:py-12">
            <Plus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No movies in your taste profile yet</p>
            <button
              onClick={() => setShowSearchModal(true)}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Add your first movie
            </button>
          </div>
        )}

        {/* Search Modal */}
        {showSearchModal && (
          <div className={`${styles.backdropEnter} fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4`}>
            <div className={`${styles.sheetEnter} flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-[#11100e] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-[#f4ead4] shadow-2xl sm:max-h-[88vh] sm:rounded-2xl sm:border-b sm:p-6`}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-serif text-xl font-semibold text-[#f4ead4] sm:text-2xl">Add to Your Taste</h3>
                <button
                  onClick={() => {
                    if (searchTimer.current) clearTimeout(searchTimer.current);
                    searchRequestId.current += 1;
                    setSearching(false);
                    setShowSearchModal(false);
                    setSearchResults([]);
                    setSearchQuery("");
                    setSelectedAdded(null);
                    setSimilarRecommendations([]);
                  }}
                  className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content Type Toggle */}
              <div className="mb-3 flex gap-5 border-b border-white/10">
                <button
                  onClick={() => {
                    if (searchTimer.current) clearTimeout(searchTimer.current);
                    searchRequestId.current += 1;
                    setSearching(false);
                    setContentType("movie");
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={`relative flex-shrink-0 px-1 pb-3 text-sm font-medium transition-colors ${
                    contentType === "movie"
                      ? "text-[#ff7a18] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#ff7a18]"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  Movies
                </button>
                <button
                  onClick={() => {
                    if (searchTimer.current) clearTimeout(searchTimer.current);
                    searchRequestId.current += 1;
                    setSearching(false);
                    setContentType("tv");
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={`relative flex-shrink-0 px-1 pb-3 text-sm font-medium transition-colors ${
                    contentType === "tv"
                      ? "text-[#ff7a18] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#ff7a18]"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  TV Shows
                </button>
              </div>

              {/* Search Input */}
              <div className="mb-4 flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      if (searchTimer.current) clearTimeout(searchTimer.current);
                      const nextQuery = e.target.value;
                      searchRequestId.current += 1;
                      setSearchQuery(nextQuery);
                      setSearchResults([]);
                      setSearching(Boolean(nextQuery.trim()));
                      searchTimer.current = setTimeout(() => void handleSearch(nextQuery), 320);
                    }}
                    placeholder={`Search ${contentType === "movie" ? "movies" : "TV shows"}...`}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-[#f4ead4] outline-none placeholder:text-white/40 focus:border-[#ff7a18]/70"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
                <div className={`grid gap-5 lg:h-full lg:min-h-0 ${selectedAdded ? "lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}`}>
                <div className="min-h-0 pr-1 lg:overflow-y-auto">
                {!searchQuery.trim() ? (
                  <section aria-label="Recommended titles">
                    <h4 className="mb-3 font-serif text-lg text-[#f4ead4]">{recommendationHeading}</h4>
                    {loadingRecommendations ? (
                      <p className="py-8 text-center text-sm text-white/50">Finding a few good picks…</p>
                    ) : recommendations.length ? (
                      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                        {recommendations.map((result) => {
                          const isAlreadyAdded = tastes.some((taste) => taste.content_id === result.id && taste.content_type === contentType);
                          const isHighlighted = isAlreadyAdded || addingContent === `${contentType}-${result.id}`;
                          return <button key={result.id} type="button" aria-pressed={isAlreadyAdded} aria-label={`${isAlreadyAdded ? "Already added" : "Add"} ${result.title} to Your Taste`} onClick={() => void handleAddToTaste(result.id)} disabled={isAlreadyAdded || addingContent === `${contentType}-${result.id}`} className="group min-w-0 text-left">
                            <div className={`relative aspect-[2/3] overflow-hidden bg-white/[0.04] transition ${isHighlighted ? "border-2 border-[#ff7a18]" : "border border-transparent group-hover:border-[#ff7a18]/60"}`}>
                              {result.poster_url ? <img src={result.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="h-full w-full bg-white/[0.03]" />}
                            </div>
                          </button>;
                        })}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-white/50">No picks yet. Search for a title you like.</p>
                    )}
                  </section>
                ) : searching ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#ff7a18]" /></div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                    {searchResults.map((result) => {
                      const isAlreadyAdded = tastes.some((taste) => taste.content_id === result.id && taste.content_type === contentType);
                      const isHighlighted = isAlreadyAdded || addingContent === `${contentType}-${result.id}`;
                      const posterUrl = result.poster_url || (result.poster_path ? getTMDBImageUrl(result.poster_path, "w300") : null);
                      return (
                        <button key={`${contentType}-${result.id}`} type="button" aria-pressed={isAlreadyAdded} aria-label={`${isAlreadyAdded ? "Already added" : "Add"} ${result.title || result.name} to Your Taste`} onClick={() => void handleAddToTaste(result.id)} disabled={isAlreadyAdded || addingContent === `${contentType}-${result.id}`} className="group min-w-0 text-left">
                          <span className={`relative block aspect-[2/3] overflow-hidden bg-white/[0.04] transition ${isHighlighted ? "border-2 border-[#ff7a18]" : "border border-transparent group-hover:border-[#ff7a18]/60"}`}>
                            {posterUrl ? <img src={posterUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" /> : <span className="block h-full w-full bg-white/[0.03]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-white/50">No results found</div>
                )}
              </div>
              {selectedAdded && (
                <aside key={selectedAdded.id} aria-label={`Added ${selectedAdded.title}; similar picks`} className={`${styles.similarPanel} min-h-0 border-t border-white/10 pt-5 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0`} aria-live="polite">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-[4.5rem] w-12 flex-shrink-0 overflow-hidden border-2 border-[#ff7a18] bg-white/5">
                      {selectedAdded.poster_url && <img src={selectedAdded.poster_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff7a18]">Added to your taste</p>
                    </div>
                  </div>
                  <h4 className="mb-3 font-serif text-lg text-[#f4ead4]">Similar picks</h4>
                  {loadingSimilar ? (
                    <div className="flex items-center gap-2 py-5 text-sm text-white/50"><Loader2 size={16} className="animate-spin text-[#ff7a18]" /> Finding more like it…</div>
                  ) : similarRecommendations.length ? (
                    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-2">
                      {similarRecommendations.slice(0, 5).map((movie, index) => (
                        <button key={movie.id} type="button" aria-label={`Add ${movie.title} to Your Taste`} onClick={() => void handleAddToTaste(movie.id)} disabled={addingContent === `${contentType}-${movie.id}`} className={`${styles.similarPoster} group min-w-0 text-left disabled:opacity-50`} style={{ animationDelay: `${index * 55}ms` }}>
                          <span className="relative block aspect-[2/3] overflow-hidden border border-transparent bg-white/[0.04] transition group-hover:border-[#ff7a18]/60">
                            {movie.poster_url ? <img src={movie.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" /> : <span className="block h-full w-full bg-white/[0.03]" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-sm text-white/50">No similar titles found yet.</p>
                  )}
                </aside>
              )}
            </div>
          </div>
          </div>
        </div>
        )}
      </div>
    </PageLayout>
  );
}
