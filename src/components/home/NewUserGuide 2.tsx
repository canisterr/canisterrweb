"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTmdbPosterUrl } from "@/lib/performance";

type Title = { id: number; title?: string; name?: string; poster_path?: string | null; release_date?: string; first_air_date?: string };
type Results = { results?: Title[] };

async function getPopular(path: string) {
  const response = await fetch(`/api/tmdb/${path}?language=en-US&page=1`);
  if (!response.ok) throw new Error("Popular titles unavailable");
  return response.json() as Promise<Results>;
}

function PopularRail({ label, items, type }: { label: string; items: Title[]; type: "movie" | "tv" }) {
  return <section className="mb-8">
    <div className="mb-3 flex items-baseline justify-between border-b border-white/10 pb-2"><h2 className="text-xl font-black text-[#f5f0de]">Popular {label}</h2><span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff9b52]">Popular now</span></div>
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const title = item.title || item.name || "Untitled";
        const poster = getTmdbPosterUrl(item.poster_path, "w342");
        return <Link key={item.id} href={`/${type}/${item.id}`} className="group w-28 shrink-0 sm:w-36">
          <div className="relative aspect-[2/3] overflow-hidden border border-white/10 bg-[#151515] transition group-hover:border-[#ff7a1a]/70">{poster && <Image src={poster} alt={title} fill sizes="144px" className="object-cover" />}</div>
          <p className="mt-2 truncate text-xs font-bold text-[#f5f0de]">{title}</p>
        </Link>;
      })}
    </div>
  </section>;
}

export default function NewUserGuide() {
  const [movies, setMovies] = useState<Title[]>([]);
  const [shows, setShows] = useState<Title[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getPopular("movie/popular"), getPopular("tv/popular")])
      .then(([movieResult, tvResult]) => {
        if (!active) return;
        if (movieResult.status === "fulfilled") setMovies(movieResult.value.results?.slice(0, 10) || []);
        if (tvResult.status === "fulfilled") setShows(tvResult.value.results?.slice(0, 10) || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return <section className="mb-10 border-b border-white/10 pb-8">
    <PopularRail label="movies" items={movies} type="movie" />
    <PopularRail label="TV shows" items={shows} type="tv" />
    <div className="mt-8 border-t border-white/10 pt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#ff9b52]">Start here</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-[#f5f0de]">A place for everything you watch.</h2>
      <div className="mt-4 divide-y divide-white/10 border-y border-white/10">
        <Link href="/logs" className="flex items-center gap-4 py-3 transition hover:text-[#ff9b52]"><span className="w-7 text-xs font-black text-[#ff9b52]">01</span><span className="min-w-0 flex-1"><strong className="text-sm">Log a film or show</strong><span className="ml-2 text-sm text-white/45">Add a date and your rating.</span></span><span aria-hidden="true" className="text-white/40">→</span></Link>
        <Link href="/lists" className="flex items-center gap-4 py-3 transition hover:text-[#ff9b52]"><span className="w-7 text-xs font-black text-[#ff9b52]">02</span><span className="min-w-0 flex-1"><strong className="text-sm">Make a list</strong><span className="ml-2 text-sm text-white/45">Collect picks for a mood or a friend.</span></span><span aria-hidden="true" className="text-white/40">→</span></Link>
        <Link href="/friends" className="flex items-center gap-4 py-3 transition hover:text-[#ff9b52]"><span className="w-7 text-xs font-black text-[#ff9b52]">03</span><span className="min-w-0 flex-1"><strong className="text-sm">Find your people</strong><span className="ml-2 text-sm text-white/45">Follow friends and see their watch logs.</span></span><span aria-hidden="true" className="text-white/40">→</span></Link>
      </div>
    </div>
  </section>;
}
