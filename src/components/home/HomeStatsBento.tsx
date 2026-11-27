"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { onValue, ref, update } from "firebase/database";
import type { MovieLog, User } from "@/types";
import { db } from "@/lib/firebase";
import { readBrowserCacheEntry } from "@/lib/browser-cache";
import { getBlurDataUrl } from "@/lib/performance";
import { getCountryCode } from "@/lib/passport";
import { scheduleHonoursRecalculation } from "@/lib/honours-client";
import { usePosterAccent } from "@/hooks/usePosterAccent";
import styles from "./HomeStatsBento.module.css";

type CachedDetails = {
  title?: string;
  name?: string;
  poster_url?: string | null;
  release_date?: string | null;
  premiered?: string | null;
  original_language?: string | null;
  runtime?: number | null;
  vote_count?: number | null;
  vote_average?: number | null;
  budget?: number | null;
  language?: string | null;
  rating?: number | null;
  popularity?: number | null;
  genres?: string[] | null;
  country?: string | null;
  countries?: string[] | null;
  production_countries?: Array<{ name?: string | null }> | null;
  origin_countries?: string[] | null;
  status?: string | null;
  network?: { name?: string } | null;
  networks?: string[] | null;
  season_count?: number | null;
  episode_count?: number | null;
  regular_episodes?: Array<{ season: number; episode: number; runtime?: number | null; released?: boolean; air_date?: string | null }> | null;
  regular_episode_inventory_complete?: boolean;
  episode_runtime_by_key?: Record<string, number> | null;
  collection_id?: number | null;
  belongs_to_collection?: { id?: number | null } | null;
  collection_movie_ids?: number[] | null;
  released_feature_filmography_ids?: Record<string, number[]> | null;
  director?: string | null;
  actors?: string[] | null;
  cast_details?: Array<{ name?: string | null; profile_url?: string | null }> | null;
  crew_details?: Array<{ name?: string | null; job?: string | null; profile_url?: string | null }> | null;
};

type WatchEntry = {
  log: MovieLog;
  title: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  runtime: number | null;
  genres: string[];
  primaryCountry: string | null;
  directors: string[];
  actors: string[];
  directorFaces: Map<string, string>;
  actorFaces: Map<string, string>;
};

const CARD = "relative min-w-0 overflow-hidden rounded-xl border sm:rounded-2xl";
const SURFACE = {
  carbon: "border-[#f5f0de]/15 bg-[#0e0d0b]",
  charcoal: "border-[#f5f0de]/10 bg-[#1c1a17]",
  orange: "border-[#c45b2a] bg-[#c45b2a]",
  cream: "border-[#f5f0de] bg-[#f5f0de]",
};
type StatsTone = keyof typeof SURFACE;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryDisplayName(country: string): string {
  if (country === "United States of America") return "United States";
  return /^[a-z]{2}$/i.test(country) ? regionNames.of(country.toUpperCase()) || country : country;
}

function storyKey(log: MovieLog): string {
  return `${log.content_type}_${log.content_id}`;
}

function compactStoryDetails(details: CachedDetails): CachedDetails {
  return JSON.parse(JSON.stringify({
    title: details.title,
    name: details.name,
    poster_url: details.poster_url,
    release_date: details.release_date,
    premiered: details.premiered,
    original_language: details.original_language,
    runtime: details.runtime,
    vote_count: details.vote_count,
    vote_average: details.vote_average,
    budget: details.budget,
    language: details.language,
    rating: details.rating,
    popularity: details.popularity,
    genres: details.genres,
    country: details.country,
    countries: details.countries,
    production_countries: details.production_countries,
    origin_countries: details.origin_countries,
    status: details.status,
    network: details.network,
    networks: details.networks,
    season_count: details.season_count,
    episode_count: details.episode_count,
    regular_episodes: details.regular_episodes,
    regular_episode_inventory_complete: details.regular_episode_inventory_complete,
    episode_runtime_by_key: details.episode_runtime_by_key,
    collection_id: details.collection_id,
    belongs_to_collection: details.belongs_to_collection,
    collection_movie_ids: details.collection_movie_ids,
    released_feature_filmography_ids: details.released_feature_filmography_ids,
    director: details.director,
    actors: details.actors?.slice(0, 5),
    cast_details: details.cast_details?.slice(0, 5),
    crew_details: details.crew_details?.filter((person) => person.job === "Director"),
  })) as CachedDetails;
}

function mostWatchedMovieId(logs: MovieLog[]): number | undefined {
  const filmCounts = new Map<number, { count: number; latestDate: string }>();
  for (const log of logs) {
    if (log.content_type !== "movie") continue;
    const current = filmCounts.get(log.content_id);
    filmCounts.set(log.content_id, {
      count: (current?.count || 0) + 1,
      latestDate: current && current.latestDate > log.watched_date ? current.latestDate : log.watched_date,
    });
  }
  return [...filmCounts.entries()].sort((a, b) =>
    b[1].count - a[1].count || b[1].latestDate.localeCompare(a[1].latestDate)
  )[0]?.[0];
}

function getWatchEntry(log: MovieLog, details: CachedDetails | null): WatchEntry {
  const releaseDate = details?.release_date || details?.premiered || "";
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  const primaryCountry = details?.country || details?.countries?.[0] ||
    details?.production_countries?.[0]?.name || details?.origin_countries?.[0] || null;
  const directorNames = [details?.director, ...(details?.crew_details || []).filter((person) => person.job === "Director").map((person) => person.name)]
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
  const actorNames = details?.actors?.length ? details.actors : (details?.cast_details || []).map((person) => person.name || "");

  return {
    log,
    title: log.content_summary?.title || log.title_snapshot || details?.title || details?.name || null,
    posterUrl: log.content_summary?.poster_url || log.poster_url_snapshot || details?.poster_url || null,
    releaseYear: Number.isFinite(year) && year > 1880 ? year : null,
    runtime: typeof details?.runtime === "number" && details.runtime > 0 ? details.runtime : null,
    genres: Array.isArray(details?.genres) ? details.genres.filter((genre): genre is string => typeof genre === "string" && genre.length > 0) : [],
    primaryCountry: primaryCountry ? countryDisplayName(primaryCountry) : null,
    directors: Array.from(new Set(directorNames)),
    actors: Array.from(new Set(actorNames.filter((name) => typeof name === "string" && name.trim().length > 0).slice(0, 5))),
    directorFaces: new Map((details?.crew_details || []).filter((person) => person.job === "Director" && person.name && person.profile_url).map((person) => [person.name!, person.profile_url!])),
    actorFaces: new Map((details?.cast_details || []).filter((person) => person.name && person.profile_url).map((person) => [person.name!, person.profile_url!])),
  };
}

function topThree(counts: Map<string, number>): Array<[string, number]> {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
}

function TopPeopleCard({ title, items, faces, empty, tone }: { title: string; items: Array<[string, number]>; faces: Map<string, string>; empty: string; tone: StatsTone }) {
  const isCream = tone === "cream";
  return (
    <div className={`${CARD} ${SURFACE[tone]} min-h-44 p-2 text-center sm:min-h-72 sm:p-6 lg:min-h-80`}>
      <h3 className={`text-[10px] font-black uppercase tracking-[0.22em] ${isCream ? "text-[#c45b2a]" : "text-[#d46b35]"}`}>{title}</h3>
      {items.length > 0 ? <div className="mt-4 flex justify-center sm:mt-6">
        {items.map(([name, count]) => <div key={name} className="flex w-1/3 min-w-0 flex-col items-center gap-1.5 px-0.5 sm:gap-2 sm:px-2">
          <span className="relative flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#29211e] text-sm font-black text-[#ff9b52] sm:w-16 sm:text-lg lg:w-20">
            {faces.get(name) ? <Image src={faces.get(name)!} alt="" fill sizes="(max-width: 639px) 48px, (max-width: 1023px) 64px, 80px" className="object-cover" /> : name.slice(0, 1).toUpperCase()}
          </span>
          <span title={name} className={`flex min-h-8 min-w-0 items-center justify-center text-[9px] font-bold leading-tight sm:min-h-10 sm:text-sm sm:leading-snug ${isCream ? "text-[#0e0d0b]" : "text-[#f5f0de]"}`}>
            <span className="line-clamp-2 break-words">{name}</span>
          </span>
          <span className={`text-[11px] ${isCream ? "text-[#0e0d0b]/55" : "text-[#f5f0de]/45"}`}>{count}</span>
        </div>)}
      </div> : <p className="mt-5 text-sm leading-6 text-white/40">{empty}</p>}
    </div>
  );
}

function ratingLabel(reaction: MovieLog["reaction"]): string | null {
  if (reaction === 2) return "Masterpiece";
  if (reaction === 1.5) return "Average";
  if (reaction === 1) return "Good";
  if (reaction === 0) return "Bad";
  return null;
}

function StatCard({ label, value, href }: { label: string; value: number | string; href: string }) {
  const isAccent = label === "Movies";
  return (
    <Link href={href} className="group flex h-24 flex-col items-center justify-center p-2 text-center transition-colors hover:text-[#c45b2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c45b2a] sm:h-28 sm:p-3 lg:h-32">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#f5f0de]/45 sm:text-[10px] sm:tracking-[0.18em]">{label}</p>
      <p className={`mt-2 text-3xl font-black leading-none tracking-[0.08em] transition-colors sm:mt-3 sm:text-5xl ${isAccent ? "text-[#d46b35] group-hover:text-[#f5f0de]" : "text-[#f5f0de] group-hover:text-[#d46b35]"}`}>{value}</p>
    </Link>
  );
}

function RatingDistribution({ logs }: { logs: MovieLog[] }) {
  const categories = [
    { label: "Bad", key: "bad", count: logs.filter((log) => log.reaction === 0).length, color: "#595959", text: "text-[#777]" },
    { label: "Average", key: "average", count: logs.filter((log) => log.reaction === 1.5).length, color: "#918a7c", text: "text-[#a49d90]" },
    { label: "Good", key: "good", count: logs.filter((log) => log.reaction === 1).length, color: "#f5f0de", text: "text-[#f5f0de]" },
    { label: "Masterpiece", key: "masterpiece", count: logs.filter((log) => log.reaction === 2).length, color: "#ff7a1a", text: "text-[#ff7a1a]" },
  ];
  const total = categories.reduce((sum, category) => sum + category.count, 0);
  const segmentCount = 40;
  const segments = categories.map((category) => ({
    ...category,
    segments: total ? Math.floor((category.count / total) * segmentCount) : 0,
    percentage: total ? Math.round((category.count / total) * 100) : 0,
  }));

  if (total > 0) {
    const remaining = segmentCount - segments.reduce((sum, category) => sum + category.segments, 0);
    const ranked = categories.map((category, index) => ({
      index,
      remainder: ((category.count / total) * segmentCount) % 1,
    })).sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; index < remaining; index += 1) {
      segments[ranked[index % ranked.length].index].segments += 1;
    }
  }

  return <div className="col-span-3 min-w-0 px-2 py-4 sm:px-6 sm:py-6">
    <div className="grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }} role="img" aria-label={`Rating distribution across ${total} ratings`}>
      {total > 0
        ? segments.flatMap((category) => Array.from({ length: category.segments }, (_, index) => <span key={`${category.key}-${index}`} className="h-7 rounded-[2px] sm:h-9" style={{ backgroundColor: category.color }} />))
        : Array.from({ length: segmentCount }, (_, index) => <span key={index} className="h-7 rounded-[2px] bg-white/10 sm:h-9" />)}
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2 sm:mt-4 sm:gap-4">
      {segments.map((category) => <div key={category.key} className="min-w-0 text-center">
        <span className={`block text-lg font-black tabular-nums sm:text-2xl ${category.text}`}>{category.percentage}%</span>
        <span className="mt-1 block truncate text-[11px] text-white/55 sm:text-sm">{category.label}</span>
      </div>)}
    </div>
  </div>;
}

function RewatchedFilmsModal({ films, onClose }: { films: Array<{ id: number; entry: WatchEntry; count: number }>; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onEscape); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" role="presentation">
    <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close rewatched films" />
    <section role="dialog" aria-modal="true" aria-labelledby="rewatched-films-title" className="relative flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#141414] text-[#f5f0de] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-5">
        <div><h3 id="rewatched-films-title" className="text-xl font-black">Rewatched films</h3><p className="mt-1 text-xs text-white/45">{films.length} {films.length === 1 ? "film" : "films"} watched more than once</p></div>
        <button type="button" onClick={onClose} aria-label="Close rewatched films" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={20} /></button>
      </div>
      <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
        {films.length ? films.map(({ id, entry, count }) => <Link key={id} href={`/movie/${id}`} prefetch={false} className="flex items-center gap-4 border-b border-white/10 p-2 last:border-0 hover:bg-white/5">
          <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-white/5">{entry.posterUrl ? <Image src={entry.posterUrl} alt="" fill sizes="56px" className="object-cover" /> : null}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{entry.title || `Movie ${id}`}</span><span className="mt-1 block text-xs text-white/45">{count} watches</span></span>
        </Link>) : <p className="p-6 text-center text-sm text-white/50">No films rewatched yet.</p>}
      </div>
    </section>
  </div>;
}

export default function HomeStatsBento({ user, logs }: { user: User; logs: MovieLog[] | null }) {
  const [detailsByKey, setDetailsByKey] = useState<Record<string, CachedDetails | null>>({});
  const [showRewatchedFilms, setShowRewatchedFilms] = useState(false);

  useEffect(() => {
    if (!logs?.length) return;
    const detailsRef = ref(db, `watched_movies_meta/${user.id}/story_details`);
    const uploaded = new Set<string>();
    const unsubscribe = onValue(detailsRef, (snapshot) => {
      const shared = (snapshot.val() || {}) as Record<string, CachedDetails>;
      setDetailsByKey(shared);

      // Legacy logs have detail records in browser caches. Publish those once so
      // every browser uses the same complete data, without refetching TMDB.
      const additions: Record<string, CachedDetails> = {};
      for (const log of logs) {
        if (log.watch_later || !log.watched_date) continue;
        const key = storyKey(log);
        if (uploaded.has(key)) continue;
        const existing = shared[key];
        const prefixes = log.content_type === "tv" ? ["tv:show-details:v2", "tv:show-details:v1"] : ["tmdb:movie-details:v2", "tmdb:movie-details:v1"];
        const cached = prefixes.map((prefix) => readBrowserCacheEntry<CachedDetails>(`${prefix}:${log.content_id}`)?.value).find(Boolean);
        if (!cached) continue;
        const compact = compactStoryDetails(cached);
        if (existing) {
          const missing = Object.fromEntries(Object.entries(compact).filter(([field, value]) =>
            (existing[field as keyof CachedDetails] == null || existing[field as keyof CachedDetails] === "") && value != null
          ));
          if (Object.keys(missing).length === 0) continue;
          additions[key] = { ...existing, ...missing };
        } else {
          additions[key] = compact;
        }
        uploaded.add(key);
      }
      if (Object.keys(additions).length > 0) {
        void update(detailsRef, additions).then(() => scheduleHonoursRecalculation(user.id)).catch((error) => {
          console.warn("Could not sync screen story details:", error);
          Object.keys(additions).forEach((key) => uploaded.delete(key));
        });
      }
    }, (error) => console.warn("Could not read screen story details:", error));
    return unsubscribe;
  }, [logs, user.id]);

  const watchedLogs = (logs || []).filter((log) => !log.watch_later && Boolean(log.watched_date));
  const entries = watchedLogs.map((log) => getWatchEntry(log, detailsByKey[storyKey(log)] ?? null));
  const recent = entries.slice().sort((a, b) => b.log.watched_date.localeCompare(a.log.watched_date) || b.log.created_at.localeCompare(a.log.created_at))[0];
  const movieIds = new Set(entries.filter(({ log }) => log.content_type === "movie").map(({ log }) => log.content_id));
  const showIds = new Set(entries.filter(({ log }) => log.content_type === "tv").map(({ log }) => log.content_id));
  const uniqueCount = movieIds.size + showIds.size;
  const rewatchCount = Math.max(0, watchedLogs.length - uniqueCount);
  const filmWatches = new Map<number, { entry: WatchEntry; count: number }>();
  for (const entry of entries) {
    if (entry.log.content_type !== "movie") continue;
    const current = filmWatches.get(entry.log.content_id);
    filmWatches.set(entry.log.content_id, {
      entry: !current || entry.posterUrl && !current.entry.posterUrl ? entry : current.entry,
      count: (current?.count || 0) + 1,
    });
  }
  const mostWatchedFilm = filmWatches.get(mostWatchedMovieId(watchedLogs) ?? -1) || null;
  const rewatchedFilms = [...filmWatches.entries()].filter(([, film]) => film.count > 1)
    .map(([id, film]) => ({ id, ...film }))
    .sort((a, b) => b.count - a.count || (a.entry.title || "").localeCompare(b.entry.title || ""));

  const genreCounts = new Map<string, number>();
  let watchMinutes = 0;
  let runtimeCoverage = 0;
  for (const entry of entries) {
    if (entry.genres.length > 0) {
      for (const genre of new Set(entry.genres)) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }
  for (const entry of entries) {
    if (entry.runtime !== null) {
      watchMinutes += entry.runtime;
      runtimeCoverage += 1;
    }
  }
  const rankedGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const topGenres = rankedGenres.slice(0, 5);
  const genreTotal = rankedGenres.reduce((sum, [, count]) => sum + count, 0);
  const uniqueEntries = new Map(entries.map((entry) => [storyKey(entry.log), entry]));
  const countryEntries = [...uniqueEntries.values()].filter((entry) => entry.primaryCountry);
  const countryCounts = new Map<string, number>();
  for (const entry of countryEntries) {
    const country = entry.primaryCountry!;
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }
  const topCountries = topThree(countryCounts);
  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const directorFaces = new Map<string, string>();
  const actorFaces = new Map<string, string>();
  for (const entry of uniqueEntries.values()) {
    for (const director of entry.directors) directorCounts.set(director, (directorCounts.get(director) || 0) + 1);
    for (const actor of entry.actors) actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
    for (const [name, url] of entry.directorFaces) directorFaces.set(name, url);
    for (const [name, url] of entry.actorFaces) actorFaces.set(name, url);
  }
  const watchHours = Math.round(watchMinutes / 60);
  const watchDays = (watchMinutes / 1440).toFixed(1);
  const watchTimeIsPartial = runtimeCoverage < watchedLogs.length;
  const recentDate = recent ? new Date(`${recent.log.watched_date}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : null;
  const verdict = recent ? ratingLabel(recent.log.reaction) : null;

  const recentPosterAccent = usePosterAccent(recent?.posterUrl, recent?.title || recent?.log.id || "recently watched");
  const mostWatchedPosterAccent = usePosterAccent(
    mostWatchedFilm?.entry.posterUrl,
    mostWatchedFilm?.entry.title || mostWatchedFilm?.entry.log.id || "most watched film"
  );

  return (
    <section className={`${styles.storyFont} mb-10`} aria-labelledby="home-stats-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id="home-stats-heading" className="text-xl font-black tracking-[-0.04em] text-[#f5f0de] sm:text-2xl">Your screen story</h2>
        </div>
        <Link href={`/profile/${encodeURIComponent(user.username)}`} className="shrink-0 text-xs font-bold text-white/45 transition hover:text-[#ff9b52]">Full profile</Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Link href={recent ? `/logs/${recent.log.id}` : "/logs"} className={`${CARD} group relative col-span-3 flex min-h-52 items-stretch border-white/15 transition duration-300 hover:border-white/35 sm:min-h-60`} style={{ backgroundColor: recentPosterAccent.background }}>
          <div className="relative m-4 aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-2xl sm:m-5 sm:w-32">
            {recent?.posterUrl ? <Image src={recent.posterUrl} alt="" fill sizes="128px" className="object-cover" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-white">No poster</span>}
          </div>
          <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-3 py-6 pl-4 pr-4 sm:pl-6 sm:pr-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white">Recently watched</p>
            <h3 className="break-words text-2xl font-black leading-tight tracking-normal text-white sm:text-5xl">{logs === null ? "Loading your diary…" : recent?.title || (recent ? "Your latest log" : "Your next watch starts here")}</h3>
            {recent ? (
              <>
                <p className="text-base font-semibold text-white">{recent.log.content_type === "tv" ? "TV show" : "Movie"}{recent.releaseYear ? ` · ${recent.releaseYear}` : ""}</p>
                <div className="flex flex-wrap items-center gap-2 text-base leading-none text-white sm:gap-3 sm:text-lg">
                  {verdict ? <span className="relative -left-2 inline-flex h-10 items-center justify-center rounded-full border border-white/30 bg-white/10 px-3.5 font-bold leading-none text-white">{verdict}</span> : null}
                  <span className="inline-flex h-10 items-center font-semibold leading-none">{recentDate}</span>
                </div>
              </>
            ) : <p className="text-sm text-white">Log a movie or show to begin your story.</p>}
          </div>
        </Link>

        <div className="contents">
          <StatCard label="Total logs" value={logs === null ? "—" : watchedLogs.length} href="/logs?filter=all&view=all" />
          <StatCard label="Movies" value={logs === null ? "—" : movieIds.size} href="/logs?filter=movie&view=all" />
          <StatCard label="TV shows" value={logs === null ? "—" : showIds.size} href="/logs?filter=tv&view=all" />
        </div>
        <RatingDistribution logs={watchedLogs} />

        <div className="contents">
          {topGenres.length > 0 && (
          <div className={`${CARD} ${SURFACE.orange} col-span-2 row-span-2 flex min-h-0 flex-col p-3 sm:p-7`}>
            <h3 className="text-lg font-black tracking-tight text-[#0e0d0b] sm:text-2xl">Top genres</h3>
              <div className="mt-5 flex flex-1 flex-col justify-center">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 sm:gap-8">
                  <div className="min-w-0 text-left">
                    <p className="break-words text-3xl font-black leading-tight tracking-[-0.04em] text-[#0e0d0b] sm:text-5xl">{topGenres[0][0]}</p>
                    <p className="mt-2 text-5xl font-black leading-none tracking-[-0.04em] text-[#0e0d0b] sm:text-7xl">{Math.round(topGenres[0][1] / genreTotal * 100)}<span className="text-[0.62em]">%</span></p>
                  </div>
                  <div className="space-y-3 border-l border-[#0e0d0b]/20 pl-3 sm:space-y-5 sm:pl-6">
                    {topGenres.slice(1).map(([genre, count]) => <div key={genre} className="flex items-center justify-between gap-1 sm:gap-3">
                      <span className="min-w-0 truncate text-sm font-bold text-[#0e0d0b]/85 sm:text-xl">{genre}</span>
                      <span className="shrink-0 text-xl font-black tabular-nums text-[#0e0d0b] sm:text-3xl">{Math.round(count / genreTotal * 100)}%</span>
                    </div>)}
                  </div>
                </div>
              </div>
          </div>
          )}
          <div className="contents">
            {runtimeCoverage > 0 && (
            <div className={`${CARD} ${SURFACE.charcoal} flex min-h-32 flex-col items-center justify-center p-2 text-center sm:p-4`}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f5f0de]/55">Watch time</p>
              <p className="mt-3 text-2xl font-black tracking-[0.06em] text-[#f5f0de] sm:text-4xl">{watchHours}{watchTimeIsPartial ? "+" : ""}<span className="ml-2 text-[10px] tracking-normal text-[#f5f0de]/45 sm:text-base">hrs</span></p>
              <p className="mt-2 text-[10px] text-[#f5f0de]/45 sm:text-xs">{watchTimeIsPartial ? "At least" : "About"} {watchDays} days</p>
            </div>
            )}
            <div className={`${CARD} ${SURFACE.cream} flex min-h-32 flex-col items-center justify-center gap-3 p-2 text-center sm:gap-4 sm:p-4`}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0e0d0b]/60 sm:text-sm">Rewatches</p>
              <p className="text-4xl font-black leading-none tracking-[0.04em] text-[#0e0d0b] sm:text-6xl">{rewatchCount}</p>
            </div>
          </div>
        </div>

        <div className="contents">
          {mostWatchedFilm?.entry.posterUrl && <button type="button" onClick={() => setShowRewatchedFilms(true)} aria-label="View all rewatched films" className={`${CARD} border-0 flex min-h-52 flex-col items-center px-2 pt-4 text-center transition focus-visible:outline-2 focus-visible:outline-[#ff7a1a] sm:min-h-72 sm:pt-5`} style={{ backgroundColor: mostWatchedPosterAccent.background }}>
            {mostWatchedFilm?.entry.posterUrl ? <Image src={mostWatchedFilm.entry.posterUrl} alt="" fill sizes="(max-width: 639px) 33vw, 260px" className="object-cover" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">No poster</span>}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
            <p className="relative z-10 text-[10px] font-black uppercase tracking-[0.22em] text-white">Most watched film</p>
          </button>}
          {topCountries.length > 0 && <Link href="/passport" className={`${CARD} ${SURFACE.charcoal} group col-span-2 flex min-h-48 flex-col items-center justify-center p-2 text-center transition hover:border-[#c45b2a]/60 focus-visible:outline-2 focus-visible:outline-[#c45b2a] sm:p-6 lg:min-h-0`}>
            <h3 className="text-xl font-black leading-tight tracking-[-0.04em] text-[#f5f0de] sm:text-3xl">Your most watched countries</h3>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#d46b35] sm:text-xs">Explore your Cine Passport →</p>
              <div className="mt-4 flex w-full max-w-xl justify-center sm:mt-6">
                {topCountries.map(([country, count]) => {
                  const countryCode = getCountryCode(country);
                  return (
                    <div key={country} className="flex w-1/3 min-w-0 flex-col items-center justify-center gap-2 px-1 sm:gap-3 sm:px-2">
                      {countryCode ? (
                        <span className="relative size-14 overflow-hidden rounded-full border border-white/15 shadow-lg sm:size-24 lg:size-28">
                          <Image src={`https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`} alt={`${country} flag`} fill sizes="(max-width: 639px) 56px, (max-width: 1023px) 96px, 112px" className="object-cover" />
                        </span>
                      ) : <span className="flex size-14 items-center justify-center rounded-full bg-white/10 px-1 text-center text-xs font-bold text-white sm:size-24">{country}</span>}
                      <p className="text-sm font-semibold text-[#f5f0de]/75 sm:text-base">{count} {count === 1 ? "title" : "titles"}</p>
                    </div>
                  );
                })}
              </div>
          </Link>}
        </div>

        {(directorCounts.size > 0 || actorCounts.size > 0) && <div className="col-span-3 grid grid-cols-2 gap-2 sm:gap-4">
          {directorCounts.size > 0 && <TopPeopleCard title="Top directors" items={topThree(directorCounts)} faces={directorFaces} empty="" tone="carbon" />}
          {actorCounts.size > 0 && <TopPeopleCard title="Top actors" items={topThree(actorCounts)} faces={actorFaces} empty="" tone="cream" />}
        </div>}
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
        Stats show unique titles only; rewatches excluded. See your{" "}
        <Link href={`/profile/${encodeURIComponent(user.username)}`} className="font-semibold text-[#ff9b52] underline-offset-2 hover:underline">
          full profile
        </Link>.
      </p>
      {showRewatchedFilms && <RewatchedFilmsModal films={rewatchedFilms} onClose={() => setShowRewatchedFilms(false)} />}
    </section>
  );
}
