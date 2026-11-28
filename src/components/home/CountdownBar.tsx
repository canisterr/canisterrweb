"use client";

import { useEffect, useRef, useState } from "react";
import Image from "@/components/AppImage";
import Link from "next/link";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import type { MovieLog } from "@/types";

type CountdownEntry = { log: MovieLog; target: number };

function getCountdownTarget(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function CountdownCard({ entry, now, active }: { entry: CountdownEntry; now: number; active: boolean }) {
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const { log, target } = entry;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setBackdrop(null);
    const detailsRequest = log.content_type === "movie"
      ? getMovieDetails(log.content_id)
      : getShowDetails(log.content_id);
    void detailsRequest.then((details) => {
      if (!cancelled) setBackdrop(details?.backdrop_gallery_urls?.[0] || details?.backdrop_url || null);
    }).catch(() => {
      if (!cancelled) setBackdrop(null);
    });
    return () => { cancelled = true; };
  }, [active, log.content_id, log.content_type]);

  const remainingHours = Math.max(0, Math.floor((target - now) / 3_600_000));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  const title = log.content_summary?.title || log.title_snapshot || "Upcoming title";
  const poster = log.content_summary?.poster_url || log.poster_url_snapshot || null;
  const href = `/${log.content_type}/${log.content_id}`;

  return (
    <Link href={href} className="group relative flex h-[64px] w-full shrink-0 snap-center items-center gap-2 overflow-hidden rounded-xl border border-white/15 bg-[#211714] px-2 shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:border-white/30 sm:h-[72px] sm:gap-3 sm:px-2.5">
      {backdrop ? <Image src={backdrop} alt="" fill sizes="(max-width: 640px) 100vw, 860px" className="object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-65" /> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-[#120d0c]/85 via-[#17110f]/65 to-[#100e11]/80" aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full min-w-0 items-center gap-2 pl-1 sm:gap-3 sm:pl-1.5">
        <div className="relative h-[50px] w-[34px] shrink-0 overflow-hidden rounded-md border border-white/35 bg-black/40 shadow-lg sm:h-[56px] sm:w-[38px]">
          {poster ? <Image src={poster} alt="" fill sizes="38px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-[7px] text-white/45">POSTER</span>}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-xs font-bold leading-tight text-white sm:text-sm">{title}</p>
          <p className="mt-0.5 text-[9px] font-medium text-white/75 sm:text-[10px]">{formatDate(log.countdown_date!)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-black/55 px-2.5 py-1.5 shadow-lg backdrop-blur-md sm:gap-1.5 sm:px-3 sm:py-2">
          <span className="flex min-w-[28px] flex-col items-center leading-none sm:min-w-[32px]">
            <span className="text-[22px] font-black tabular-nums tracking-tight text-[#fff1d7] sm:text-[26px]">{days}</span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#ffb36b] sm:text-[8px]">days</span>
          </span>
          <span className="pb-1 text-base font-bold text-white/45 sm:text-lg">:</span>
          <span className="flex min-w-[28px] flex-col items-center leading-none sm:min-w-[32px]">
            <span className="text-[22px] font-black tabular-nums tracking-tight text-[#fff1d7] sm:text-[26px]">{hours.toString().padStart(2, "0")}</span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#ffb36b] sm:text-[8px]">hours</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CountdownBar({ logs }: { logs: MovieLog[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const countdowns = logs
    .filter((log) => typeof log.countdown_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(log.countdown_date))
    .map((log) => ({ log, target: getCountdownTarget(log.countdown_date!) }))
    .filter((entry) => entry.target > now)
    .sort((first, second) => first.target - second.target);

  useEffect(() => {
    if (activeIndex >= countdowns.length) setActiveIndex(Math.max(0, countdowns.length - 1));
  }, [activeIndex, countdowns.length]);

  if (!countdowns.length) return null;

  const moveTo = (index: number) => {
    carouselRef.current?.scrollTo({ left: index * carouselRef.current.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  };

  return (
    <section className="mb-4" aria-label="Release countdowns">
      <div
        ref={carouselRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const nextIndex = Math.round(element.scrollLeft / Math.max(1, element.clientWidth));
          setActiveIndex(Math.min(countdowns.length - 1, nextIndex));
        }}
        className="flex snap-x snap-mandatory gap-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Swipe through release countdowns"
      >
        {countdowns.map((entry, index) => <CountdownCard key={entry.log.id} entry={entry} now={now} active={index === activeIndex} />)}
      </div>
      {countdowns.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5" role="group" aria-label="Choose a countdown">
          {countdowns.map((entry, index) => (
            <button
              key={entry.log.id}
              type="button"
              onClick={() => moveTo(index)}
              aria-label={`Show countdown ${index + 1}: ${entry.log.content_summary?.title || entry.log.title_snapshot || "Upcoming title"}`}
              aria-current={activeIndex === index ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? "w-5 bg-[#ff7a1a]" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
