"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Plus } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import LogMovieModal from "@/components/LogMovieModal";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { type ShowDetails } from "@/lib/tvmaze";
import { getSeasonEpisodes, getShowSeasons, type TVMazeEpisode, type TVMazeSeason } from "@/lib/tvmaze-seasons";
import type { Content, User } from "@/types";
import { resolveTvRouteParam } from "@/lib/content-slugs";

function formatYear(dateStr?: string): string {
  if (!dateStr) return "";
  const year = new Date(dateStr).getFullYear();
  return Number.isNaN(year) ? dateStr : String(year);
}

export default function TvSeasonPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showRouteParam = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const seasonParam = params.season as string;
  const searchParamsString = searchParams.toString();
  const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [showPath, setShowPath] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<TVMazeSeason | null>(null);
  const [episodes, setEpisodes] = useState<TVMazeEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showLogMovieModal, setShowLogMovieModal] = useState(false);

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
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
      } catch (error) {
        console.error("Error loading season page auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSeasonPage = async () => {
      try {
        setLoading(true);
        const resolved = await resolveTvRouteParam(showRouteParam);

        if (cancelled) return;

        if (!resolved) {
          setShow(null);
          setShowPath(null);
          setSelectedSeason(null);
          setLoading(false);
          return;
        }

        const seasonList = await getShowSeasons(resolved.show.id, resolved.show.tmdb_id);
        const numericSeason = Number(seasonParam);
        const matchingSeason = seasonList.find((season) => season.number === numericSeason) || seasonList[0] || null;

        if (cancelled) return;

        setShow(resolved.show);
        setShowPath(resolved.canonicalPath);
        setSelectedSeason(matchingSeason);

        const expectedPath = `${resolved.canonicalPath}/seasons/${matchingSeason?.number || seasonParam}`;
        if (pathname !== expectedPath) {
          const nextUrl = searchParamsString
            ? `${expectedPath}?${searchParamsString}`
            : expectedPath;
          router.replace(nextUrl);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading TV season page:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSeasonPage();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, seasonParam, searchParamsString, showRouteParam]);

  useEffect(() => {
    if (!selectedSeason) {
      setEpisodes([]);
      return;
    }

    let cancelled = false;
    const loadEpisodes = async () => {
      try {
        setLoadingEpisodes(true);
        const seasonEpisodes = await getSeasonEpisodes(selectedSeason);
        if (!cancelled) {
          setEpisodes(seasonEpisodes);
        }
      } catch (error) {
        console.error("Error loading season episodes:", error);
        if (!cancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEpisodes(false);
        }
      }
    };

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeason]);

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  const handleOpenSeasonLog = () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    setShowLogMovieModal(true);
  };

  const seasonContent = useMemo<Content | null>(() => {
    if (!show) return null;
    return show as unknown as Content;
  }, [show]);

  if (loading) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href={showPath ? `${showPath}/seasons` : "/dashboard"}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to seasons
          </Link>
        </div>

        <section className="flex items-start gap-5 py-4 sm:gap-7">
            <div className="w-24 shrink-0 overflow-hidden bg-white/5 sm:w-32">
              {selectedSeason?.image?.medium || show?.poster_url ? (
                <img loading="lazy"
                  src={selectedSeason?.image?.medium || show!.poster_url!}
                  alt={selectedSeason?.name || show?.title || show?.name || "Season poster"}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-white/5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb36b]">{show?.title || show?.name || "TV Show"}</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-[#f5f0de] sm:text-5xl">
                {selectedSeason ? selectedSeason.name : `Season ${seasonParam}`}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 sm:text-sm">
                {selectedSeason?.premiereDate ? (
                  <span>
                    {formatYear(selectedSeason.premiereDate)}
                  </span>
                ) : null}
                {selectedSeason?.episodeOrder ? (
                  <span>
                    {selectedSeason.episodeOrder} episodes
                  </span>
                ) : null}
                {show?.runtime ? (
                  <span>
                    {show.runtime} min episodes
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleOpenSeasonLog}
                  className="inline-flex items-center gap-2 bg-[#ff7a1a] px-5 py-2.5 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
                >
                  <Plus className="h-4 w-4" />
                  Log this season
                </button>
              </div>
            </div>
        </section>

        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">
                {selectedSeason ? selectedSeason.name : "Episodes"}
              </h2>
            </div>
            <span className="text-xs text-white/45">{episodes.length} episodes</span>
          </div>

          {loadingEpisodes ? (
            <div className="mt-5 grid gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse bg-white/5" />
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="mt-5 grid sm:grid-cols-2 sm:gap-x-8">
              {episodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="w-7 shrink-0 text-sm font-black text-[#ffb36b]">{String(episode.number).padStart(2, "0")}</span>
                  {episode.image?.medium && <img loading="lazy" src={episode.image.medium} alt="" className="aspect-video w-20 shrink-0 object-cover" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#f5f0de]">{episode.name}</p>
                    <p className="mt-1 text-xs text-white/45">
                      {episode.airdate || "Date unavailable"}
                      {episode.runtime ? ` • ${episode.runtime} min` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/55">
              No episodes found for this season.
            </p>
          )}
        </section>

        {seasonContent && (
          <LogMovieModal
            isOpen={showLogMovieModal}
            onClose={() => setShowLogMovieModal(false)}
            content={seasonContent}
            user={user}
            initialTvScope={selectedSeason?.number ?? "all"}
            initialTvEpisodeChoice="all"
            onLogCreated={() => {
              setShowLogMovieModal(false);
            }}
          />
        )}
      </main>
    </PageLayout>
  );
}
