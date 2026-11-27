"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "@/components/AppImage";
import { ArrowLeft, RotateCcw } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CountryFlag from "@/components/passport/CountryFlag";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { discoverPassportMovies, GENRE_MAP } from "@/lib/tmdb";
import { getTmdbPosterUrl } from "@/lib/performance";
import type { TMDBMovie } from "@/types";

const currentYear = new Date().getFullYear();
const firstYear = 1888;
const genres = Object.entries(GENRE_MAP).map(([name, id]) => ({
  id, name: name === "scifi" ? "Science fiction" : name.charAt(0).toUpperCase() + name.slice(1),
}));

export default function CountryMovies({ country }: { country: { code: string; name: string } }) {
  const { user } = useCurrentUser();
  const [genreId, setGenreId] = useState<number | undefined>();
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{ genreId?: number; fromYear?: number; toYear?: number }>({});
  const [sort, setSort] = useState<"popular" | "topRated">("popular");
  const [page, setPage] = useState(1);
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const from = fromYear ? Number(fromYear) : undefined;
  const to = toYear ? Number(toYear) : undefined;
  const invalidYear = [from, to].some((year) => year !== undefined && (!Number.isInteger(year) || year < firstYear || year > currentYear));
  const invalidRange = Boolean(from && to && from > to);
  const invalidFilters = invalidYear || invalidRange;

  useEffect(() => {
    let cancelled = false;
    discoverPassportMovies(country.code, { ...appliedFilters, page, sort })
      .then(({ movies: results, totalPages: pages, totalResults: count }) => {
        if (cancelled) return;
        setMovies((previous) => {
          if (page === 1) return results;
          const seen = new Set(previous.map((movie) => movie.id));
          return [...previous, ...results.filter((movie) => !seen.has(movie.id))];
        });
        setTotalPages(pages);
        setTotalResults(count);
        setError(false);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [country.code, appliedFilters, page, sort, retry]);

  const resetPage = () => { setPage(1); setMovies([]); setTotalPages(0); setTotalResults(0); setLoading(true); };
  const resetFilters = () => { setGenreId(undefined); setFromYear(""); setToYear(""); if (appliedFilters.genreId || appliedFilters.fromYear || appliedFilters.toYear) { setAppliedFilters({}); resetPage(); } };
  const applyFilters = () => {
    if (invalidFilters || (appliedFilters.genreId === genreId && appliedFilters.fromYear === from && appliedFilters.toYear === to)) return;
    setAppliedFilters({ genreId, fromYear: from, toYear: to });
    resetPage();
  };
  const changeSort = (nextSort: "popular" | "topRated") => { if (nextSort === sort) return; setSort(nextSort); resetPage(); };

  return (
    <PageLayout user={user}>
      <main className="mx-auto max-w-6xl pb-24 pt-8 text-[#f5f0de]">
        <Link href="/passport/discover" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-[#ff9b52]"><ArrowLeft size={15} /> All countries</Link>
        <header className="mt-10 border-b border-white/10 pb-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#ff7a1a]">Explore movies by country</p>
          <h1 className="mt-3 flex items-start gap-3 text-5xl font-black uppercase tracking-tight sm:text-7xl"><CountryFlag code={country.code} className="mt-2 h-9 w-14 rounded-sm sm:mt-3 sm:h-12 sm:w-[72px]" /><span className="min-w-0 break-words">{country.name}<span className="text-[#ff7a1a]">.</span></span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">Discover films from {country.name}. Use the filters to explore a genre or release period.</p>
        </header>

        <div className="mt-8 flex w-full gap-2 border-b border-white/10 pb-4" role="group" aria-label="Film ranking">
          <button type="button" aria-pressed={sort === "popular"} onClick={() => changeSort("popular")} className={`rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${sort === "popular" ? "bg-[#ff7a1a] text-black" : "border border-white/15 text-white/60 hover:border-[#ff7a1a]/50 hover:text-white"}`}>Popular</button>
          <button type="button" aria-pressed={sort === "topRated"} onClick={() => changeSort("topRated")} className={`rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${sort === "topRated" ? "bg-[#ff7a1a] text-black" : "border border-white/15 text-white/60 hover:border-[#ff7a1a]/50 hover:text-white"}`}>Top rated</button>
        </div>

        <div className="mt-6 border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black uppercase">Filter films</h2><button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#ff9b52] hover:text-white"><RotateCcw size={14} /> Clear filters</button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-white/55">Genre
              <select value={genreId || ""} onChange={(event) => setGenreId(event.target.value ? Number(event.target.value) : undefined)} className="mt-2 block w-full rounded-md border border-white/15 bg-[#1b1b1a] px-3 py-3 text-sm font-medium normal-case tracking-normal text-white focus:border-[#ff7a1a] focus:outline-none"><option value="">All genres</option>{genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/55">From year
              <input type="number" inputMode="numeric" min={firstYear} max={currentYear} value={fromYear} onChange={(event) => setFromYear(event.target.value)} placeholder="Any year" className="mt-2 block w-full rounded-md border border-white/15 bg-[#1b1b1a] px-3 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none placeholder:text-white/35 focus:border-[#ff7a1a]" />
            </label>
            <label className="block text-xs font-bold uppercase tracking-widest text-white/55">To year
              <input type="number" inputMode="numeric" min={firstYear} max={currentYear} value={toYear} onChange={(event) => setToYear(event.target.value)} placeholder="Any year" className="mt-2 block w-full rounded-md border border-white/15 bg-[#1b1b1a] px-3 py-3 text-sm font-medium normal-case tracking-normal text-white outline-none placeholder:text-white/35 focus:border-[#ff7a1a]" />
            </label>
          </div>
          {invalidFilters && <p role="alert" className="mt-4 text-sm text-[#ff9b52]">{invalidRange ? "The start year must be before the end year." : `Enter a year from ${firstYear} to ${currentYear}.`}</p>}
          <button type="button" disabled={invalidFilters} onClick={applyFilters} className="mt-5 rounded-full bg-[#ff7a1a] px-5 py-3 text-xs font-black uppercase tracking-widest text-black transition hover:bg-[#ff9b52] disabled:cursor-not-allowed disabled:opacity-40">Apply filters</button>
        </div>

        <section className="mt-9" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-black uppercase tracking-tight">{sort === "topRated" ? "Top rated" : "Popular"} films from {country.name}</h2>
            {totalResults > 0 && <p className="text-xs font-bold uppercase tracking-widest text-white/40">{totalResults.toLocaleString()} films</p>}
          </div>
          {movies.length > 0 && <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {movies.map((movie, index) => <Link href={`/movie/${movie.id}`} prefetch={false} key={movie.id} className="group">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/5">
                {movie.poster_path ? <Image src={getTmdbPosterUrl(movie.poster_path, "w500") || ""} alt="" width={300} height={450} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm text-white/30">No poster</div>}
                <span className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-xs font-black text-[#ffb36b]">#{index + 1}</span>
              </div>
              <p className="mt-3 text-sm font-bold group-hover:text-[#ff9b52]">{movie.title}</p>
              <p className="mt-1 text-xs text-white/40">{movie.release_date?.slice(0, 4) || "Year unknown"}</p>
            </Link>)}
          </div>}
          {loading && <p className="mt-8 text-sm text-white/50">Finding films…</p>}
          {error && <p className="mt-8 text-sm text-white/50">Films could not be loaded. <button type="button" onClick={() => { setLoading(true); setError(false); setRetry((value) => value + 1); }} className="text-[#ff9b52] underline">Try again</button></p>}
          {!loading && !error && movies.length === 0 && <p className="mt-10 text-sm text-white/50">{sort === "topRated" ? "No films with enough ratings found here. Try Popular or another filter." : "No films found for these filters. Try another genre or year range."}</p>}
          {!error && totalPages > page && <div className="mt-10 flex justify-center"><button type="button" disabled={loading} onClick={() => { setPage((value) => value + 1); setLoading(true); }} className="rounded-full border border-[#ff7a1a]/50 px-6 py-3 text-xs font-black uppercase tracking-widest text-[#ffb36b] transition hover:bg-[#ff7a1a]/10 disabled:opacity-40">{loading ? "Loading more…" : "Show more movies"}</button></div>}
        </section>
      </main>
    </PageLayout>
  );
}
