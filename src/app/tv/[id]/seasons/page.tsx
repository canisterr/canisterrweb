"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, ArrowRight } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { type ShowDetails } from "@/lib/tvmaze";
import { getSeasonEpisodes, getShowSeasons, type TVMazeEpisode, type TVMazeSeason } from "@/lib/tvmaze-seasons";
import { User } from "@/types";
import { resolveTvRouteParam } from "@/lib/content-slugs";

function formatYear(dateStr?: string): string {
  if (!dateStr) return "";
  const year = new Date(dateStr).getFullYear();
  return Number.isNaN(year) ? dateStr : String(year);
}

export default function TvSeasonsPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showRouteParam = Array.isArray(params.id) ? params.id[0] : String(params.id || "");
  const searchParamsString = searchParams.toString();

  const [user, setUser] = useState<User | null>(null);
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [showPath, setShowPath] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<TVMazeSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<TVMazeSeason | null>(null);
  const [episodes, setEpisodes] = useState<TVMazeEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

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
        console.error("Error loading season auth state:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSeasonGuide = async () => {
      try {
        setLoading(true);
        const resolved = await resolveTvRouteParam(showRouteParam);

        if (cancelled) return;

        if (!resolved) {
          setShow(null);
          setShowPath(null);
          setSeasons([]);
          setSelectedSeason(null);
          setLoading(false);
          return;
        }

        const seasonList = await getShowSeasons(resolved.show.id, resolved.show.tmdb_id);
        if (cancelled) return;

        setShow(resolved.show);
        setShowPath(resolved.canonicalPath);
        setSeasons(seasonList);
        setSelectedSeason(seasonList[0] || null);

        if (pathname !== `${resolved.canonicalPath}/seasons`) {
          const nextUrl = searchParamsString
            ? `${resolved.canonicalPath}/seasons?${searchParamsString}`
            : `${resolved.canonicalPath}/seasons`;
          router.replace(nextUrl);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading TV seasons:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSeasonGuide();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParamsString, showRouteParam]);

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

  if (loading) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={showPath || "/dashboard"}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to show
        </Link>

        <section className="flex items-start gap-5 py-4 sm:gap-7">
            <div className="w-24 shrink-0 overflow-hidden bg-white/5 sm:w-32">
              {show?.poster_url ? (
                <img loading="lazy"
                  src={show.poster_url}
                  alt={show.title || show.name}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-white/5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb36b]">Season guide</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-[#f5f0de] sm:text-5xl">
                {show?.title || show?.name || "TV Show"}
              </h1>
              {show?.overview && (
                <p className="mt-3 line-clamp-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                  {show.overview}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 sm:text-sm">
                {show?.runtime ? (
                  <span>
                    {show.runtime} min episodes
                  </span>
                ) : null}
                {show?.network?.name ? (
                  <span>
                    {show.network.name}
                  </span>
                ) : null}
              </div>
            </div>
        </section>

        <section className="mt-7 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">Seasons</h2>
            </div>
            <span className="text-xs text-white/45">{seasons.length} seasons</span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {seasons.map((season) => {
              const isSelected = selectedSeason?.id === season.id;
              return (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => setSelectedSeason(season)}
                  className={`min-w-0 border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-[#ff7a1a] bg-[#ff7a1a] text-black"
                      : "border-white/15 bg-[#111111] text-[#f5f0de] hover:border-white/40"
                  }`}
                >
                  <p className="text-xl font-black">{String(season.number).padStart(2, "0")}</p>
                  <p className="mt-1 truncate text-xs font-semibold">{season.name}</p>
                  <p className={`mt-2 text-xs ${isSelected ? "text-black/65" : "text-white/40"}`}>
                    {[season.premiereDate && formatYear(season.premiereDate), season.episodeOrder && `${season.episodeOrder} episodes`].filter(Boolean).join(" · ") || "Season"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[#f5f0de]">
                {selectedSeason ? selectedSeason.name : "Episodes"}
              </h2>
              {selectedSeason && (
                <Link
                  href={showPath ? `${showPath}/seasons/${selectedSeason.number}` : "/dashboard"}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
                >
                  Season details <ArrowRight className="h-4 w-4" />
                </Link>
              )}
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
            <div className="mt-5 grid gap-0 sm:grid-cols-2 sm:gap-x-8">
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
      </main>
    </PageLayout>
  );
}
