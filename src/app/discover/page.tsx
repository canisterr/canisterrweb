"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";
import MoodSelector from "@/components/discover/MoodSelector";
import ProviderSelector from "@/components/discover/ProviderSelector";
import QuickFilters from "@/components/discover/QuickFilters";
import SwipeDeck from "@/components/discover/SwipeDeck";
import SelectedMovieSheet from "@/components/discover/SelectedMovieSheet";
import DiscoveryEmptyState from "@/components/discover/DiscoveryEmptyState";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { fetchDiscoveryCandidates } from "@/lib/discovery/tmdbDiscovery";
import { DISCOVERY_MOODS, getMoodDefinition } from "@/lib/discovery/moodMapping";
import { getDefaultWatchRegion, getWatchProviders } from "@/lib/discovery/watchProviders";
import { applySwipeToTaste, createSessionTaste, getDiscoveryInsight } from "@/lib/discovery/sessionTaste";
import { rankDiscoveryMovies } from "@/lib/discovery/ranking";
import type { DiscoveryAction, DiscoveryFilters, DiscoveryMoodSlug, DiscoveryMovie, DiscoverySwipe, SessionTaste, WatchProvider } from "@/lib/discovery/discoveryTypes";
import { addToWatchlist, getUserMovieLogs } from "@/lib/logs";

const STORAGE_KEY = "canisterr:discover-session";

type DiscoverStep = "mood" | "providers" | "filters" | "deck";
type SheetState = { movie: DiscoveryMovie; mode: "details" | "pick" } | null;

type StoredSession = {
  step: DiscoverStep;
  mood: DiscoveryMoodSlug | null;
  providerIds: number[];
  filters: DiscoveryFilters;
  movies: DiscoveryMovie[];
  swipes: DiscoverySwipe[];
  taste: SessionTaste;
  page: number;
  region: string;
};

const DEFAULT_FILTERS: DiscoveryFilters = {
  runtime: "any",
  era: "any",
};

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Session restore is helpful, not required.
  }
}

function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

function DiscoverPageInner() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const restored = useMemo(() => readStoredSession(), []);
  const [step, setStep] = useState<DiscoverStep>(restored?.step || "mood");
  const [selectedMood, setSelectedMood] = useState<DiscoveryMoodSlug | null>(restored?.mood || null);
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>(restored?.providerIds || []);
  const [filters, setFilters] = useState<DiscoveryFilters>(restored?.filters || DEFAULT_FILTERS);
  const [movies, setMovies] = useState<DiscoveryMovie[]>(restored?.movies || []);
  const [swipes, setSwipes] = useState<DiscoverySwipe[]>(restored?.swipes || []);
  const [taste, setTaste] = useState<SessionTaste>(restored?.taste || createSessionTaste());
  const [region] = useState(restored?.region || getDefaultWatchRegion());
  const [page, setPage] = useState(restored?.page || 1);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set(restored?.swipes.map((swipe) => swipe.movieId) || []));
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [providerWarning, setProviderWarning] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [watchlistState, setWatchlistState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const mood = selectedMood ? getMoodDefinition(selectedMood) : DISCOVERY_MOODS[0];
  const anyProvider = selectedProviderIds.length === 0;
  const remainingCount = movies.length;
  const insight = getDiscoveryInsight(taste);

  useEffect(() => {
    void getWatchProviders(region).then(setProviders);
  }, [region]);

  useEffect(() => {
    if (!selectedMood) return;
    writeStoredSession({
      step,
      mood: selectedMood,
      providerIds: selectedProviderIds,
      filters,
      movies,
      swipes,
      taste,
      page,
      region,
    });
  }, [filters, movies, page, region, selectedMood, selectedProviderIds, step, swipes, taste]);

  const fetchCandidates = useCallback(
    async ({ replace = false, loosen = false }: { replace?: boolean; loosen?: boolean } = {}) => {
      if (!selectedMood) return;

      setLoadingDeck(true);
      setProviderWarning("");

      try {
        const userLogs = user ? await getUserMovieLogs(user.id, 160, user) : [];
        const watchedIds = userLogs
          .filter((log) => log.content_type === "movie" && !log.watch_later && Boolean(log.watched_date))
          .map((log) => Number(log.content_id));
        const excludedIds = Array.from(new Set([...watchedIds, ...Array.from(seenIds), ...movies.map((movie) => movie.id)]));
        const nextPage = replace ? 1 : page;
        const providerIds = loosen ? [] : selectedProviderIds;
        const nextFilters = loosen ? DEFAULT_FILTERS : filters;

        let candidates = await fetchDiscoveryCandidates({
          mood: selectedMood,
          providerIds,
          region,
          filters: nextFilters,
          page: nextPage,
          excludedIds,
        });

        if (candidates.length === 0 && providerIds.length > 0) {
          setProviderWarning("Streaming availability was too narrow, so these are broader matches. Provider info is still shown when verified.");
          candidates = await fetchDiscoveryCandidates({
            mood: selectedMood,
            providerIds: [],
            region,
            filters: nextFilters,
            page: nextPage,
            excludedIds,
          });
        }

        const ranked = rankDiscoveryMovies(candidates, getMoodDefinition(selectedMood), providerIds, taste, new Set(excludedIds));
        setMovies((current) => {
          const merged = replace ? ranked : [...current, ...ranked];
          return Array.from(new Map(merged.map((movie) => [movie.id, movie])).values());
        });
        setPage(nextPage + 1);
      } finally {
        setLoadingDeck(false);
      }
    },
    [filters, movies, page, region, seenIds, selectedMood, selectedProviderIds, taste, user]
  );

  const startDiscovery = async () => {
    setStep("deck");
    setMovies([]);
    setSwipes([]);
    setTaste(createSessionTaste());
    setSeenIds(new Set());
    setPage(1);
    await fetchCandidates({ replace: true });
  };

  useEffect(() => {
    if (step === "deck" && selectedMood && movies.length === 0 && !loadingDeck) {
      void fetchCandidates({ replace: true });
    }
  }, [fetchCandidates, loadingDeck, movies.length, selectedMood, step]);

  useEffect(() => {
    if (step === "deck" && selectedMood && movies.length <= 7 && !loadingDeck) {
      void fetchCandidates();
    }
  }, [fetchCandidates, loadingDeck, movies.length, selectedMood, step]);

  const recordSwipe = useCallback(
    (movie: DiscoveryMovie, action: DiscoveryAction) => {
      const swipe: DiscoverySwipe = {
        movieId: movie.id,
        action,
        genres: movie.genre_ids || movie.genres || [],
        runtime: movie.runtime || undefined,
        releaseYear: movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined,
        providerIds: movie.providerAvailability?.providerIds,
        keywordIds: movie.keywordIds,
      };
      const nextTaste = applySwipeToTaste(taste, swipe);
      const nextSeenIds = new Set(seenIds);
      nextSeenIds.add(movie.id);
      const remaining = movies.filter((item) => item.id !== movie.id);
      const reranked = rankDiscoveryMovies(remaining, mood, selectedProviderIds, nextTaste, nextSeenIds);

      setSwipes((current) => [...current, swipe]);
      setTaste(nextTaste);
      setSeenIds(nextSeenIds);
      setMovies(reranked);
    },
    [mood, movies, seenIds, selectedProviderIds, taste]
  );

  const handleSwipe = useCallback(
    (movie: DiscoveryMovie, action: DiscoveryAction) => {
      recordSwipe(movie, action);
      if (action === "interested") {
        setSheet({ movie, mode: "pick" });
      }
    },
    [recordSwipe]
  );

  const handleWatchlist = useCallback(
    async (movie: DiscoveryMovie) => {
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent("/discover")}`);
        return;
      }

      setWatchlistState("saving");
      try {
        await addToWatchlist(user.id, movie.id, "movie");
        recordSwipe(movie, "watchlist");
        setWatchlistState("saved");
        setTimeout(() => setWatchlistState("idle"), 1200);
      } catch {
        setWatchlistState("error");
      }
    },
    [recordSwipe, router, user]
  );

  const resetSession = () => {
    clearStoredSession();
    setStep("mood");
    setSelectedMood(null);
    setSelectedProviderIds([]);
    setFilters(DEFAULT_FILTERS);
    setMovies([]);
    setSwipes([]);
    setTaste(createSessionTaste());
    setSeenIds(new Set());
    setPage(1);
    setSheet(null);
  };

  if (loading) {
    return <RouteLoadingSkeleton title="Discover" description="Finding your movie" />;
  }

  return (
    <PageLayout user={user} theme="brutalist">
      <main className="discovery-page mx-auto w-full max-w-4xl overflow-x-hidden px-1 py-5 text-[#f5f0de] sm:px-4">
        <style jsx global>{`
          html,
          body {
            overflow-x: hidden;
          }

          .discovery-page {
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
            overscroll-behavior-x: none;
          }

          .swipe-area {
            padding-inline: 20px;
          }

          .swipe-card {
            touch-action: pan-y;
            user-select: none;
            -webkit-user-select: none;
            overscroll-behavior: contain;
          }
        `}</style>

        <div className="mb-5 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-white/32">Canisterr</div>
          <button type="button" onClick={resetSession} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/60">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        {step === "mood" ? (
          <div className="mx-auto max-w-3xl">
            <MoodSelector
              selectedMood={selectedMood}
              onSelect={(nextMood) => {
                setSelectedMood(nextMood);
                setStep("providers");
              }}
            />
          </div>
        ) : null}

        {step === "providers" ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <ProviderSelector
              providers={providers}
              selectedIds={selectedProviderIds}
              anyProvider={anyProvider}
              onAnyProvider={() => setSelectedProviderIds([])}
              onToggle={(providerId) => {
                setSelectedProviderIds((current) =>
                  current.includes(providerId) ? current.filter((id) => id !== providerId) : [...current, providerId]
                );
              }}
            />
            <button type="button" onClick={() => setStep("filters")} className="w-full rounded-full bg-[#f5f0de] px-5 py-4 text-sm font-black text-[#0a0a0a]">
              Continue
            </button>
          </div>
        ) : null}

        {step === "filters" ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <QuickFilters filters={filters} onChange={setFilters} />
            <button type="button" onClick={() => void startDiscovery()} className="w-full rounded-full bg-[#ff7a1a] px-5 py-4 text-sm font-black text-[#0a0a0a]">
              Start Discovering
            </button>
          </div>
        ) : null}

        {step === "deck" ? (
          <>
            {providerWarning ? (
              <div className="mx-auto mb-3 max-w-md rounded-2xl border border-[#ffb36b]/20 bg-[#ffb36b]/10 px-4 py-3 text-xs leading-5 text-[#f5f0de]/75">
                {providerWarning}
              </div>
            ) : null}
            {insight ? (
              <div className="mx-auto mb-3 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-left text-sm font-semibold text-[#f5f0de]">{insight}</p>
                <button type="button" onClick={() => setFilters({ ...filters, runtime: "under120" })} className="shrink-0 rounded-full bg-[#f5f0de] px-3 py-1.5 text-xs font-black text-[#0a0a0a]">
                  Yes
                </button>
              </div>
            ) : null}
            {loadingDeck && movies.length === 0 ? (
              <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
                <div className="h-[52vh] w-[78vw] max-w-[340px] rounded-[1.8rem] border border-white/10 bg-white/[0.04] shadow-[0_30px_90px_rgba(0,0,0,0.4)]" />
                <p className="mt-6 text-lg font-black text-[#f5f0de]">Finding your movie...</p>
              </div>
            ) : movies.length > 0 ? (
              <SwipeDeck
                movies={movies}
                moodName={mood.name}
                remainingCount={remainingCount}
                onSwipe={handleSwipe}
                onWatchlist={(movie) => void handleWatchlist(movie)}
                onDetails={(movie) => setSheet({ movie, mode: "details" })}
              />
            ) : (
              <DiscoveryEmptyState
                onLoosenFilters={() => {
                  setFilters(DEFAULT_FILTERS);
                  void fetchCandidates({ replace: true, loosen: true });
                }}
                onChangeMood={() => setStep("mood")}
                onChangeProviders={() => setStep("providers")}
              />
            )}
            {watchlistState === "saved" ? (
              <div className="fixed inset-x-0 bottom-5 z-[80] mx-auto w-fit rounded-full border border-[#34c759]/20 bg-[#34c759]/15 px-4 py-2 text-sm font-bold text-[#d8ffe3] backdrop-blur">
                Saved to watchlist
              </div>
            ) : null}
            {watchlistState === "error" ? (
              <div className="fixed inset-x-0 bottom-5 z-[80] mx-auto w-fit rounded-full border border-[#ff453a]/20 bg-[#ff453a]/15 px-4 py-2 text-sm font-bold text-[#ffd9d6] backdrop-blur">
                Could not save right now
              </div>
            ) : null}
          </>
        ) : null}

        <SelectedMovieSheet
          movie={sheet?.movie || null}
          mode={sheet?.mode || "details"}
          onClose={() => setSheet(null)}
          onKeepLooking={() => setSheet(null)}
        />
      </main>
    </PageLayout>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<RouteLoadingSkeleton title="Discover" description="Finding your movie" />}>
      <DiscoverPageInner />
    </Suspense>
  );
}
