"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";
import type { MovieLog } from "@/types";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";

export default function ReleaseDay({ logs }: { logs: MovieLog[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const released = logs.find((log) =>
    log.content_type === "movie" && log.watch_later && log.release_date_snapshot === today && Boolean(log.release_reminded_at)
  );
  if (!released) return null;

  const poster = getTmdbPosterUrl(released.poster_url_snapshot, "w185");
  const title = released.title_snapshot || "A movie you tracked";
  return <section className="mb-6 border border-[#ff7a1a]/30 bg-[#211a15]" aria-labelledby="release-day-heading">
    <Link href={`/movie/${released.content_id}`} className="group flex min-w-0 items-center gap-3 p-3 transition hover:bg-white/[0.04] sm:gap-4 sm:p-4">
      <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden bg-white/[0.05] sm:w-16">
        {poster ? <Image src={poster} alt="" fill sizes="(max-width: 639px) 56px, 64px" className="object-cover" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <Film className="absolute inset-0 m-auto h-5 w-5 text-white/20" />}
      </span>
      <span className="min-w-0 flex-1">
        <h2 id="release-day-heading" className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff9b52]">Out today</h2>
        <span className="mt-1 block text-xs font-semibold text-white/55">A movie on your Watchlist has reached its release date</span>
        <span className="mt-0.5 block break-words text-lg font-black leading-tight text-[#f5f0de] sm:text-xl">{title}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#ff9b52]" aria-hidden="true" />
    </Link>
  </section>;
}
