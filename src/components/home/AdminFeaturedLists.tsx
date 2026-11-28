"use client";

import { useEffect, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from "react";
import Image from "@/components/AppImage";
import Link from "next/link";
import type { FeaturedList } from "@/lib/featured-lists";
import { getMovieDetails } from "@/lib/tmdb";

let featuredListsRequest: Promise<FeaturedList[]> | null = null;

function loadFeaturedLists() {
  if (!featuredListsRequest) {
    const request = fetch("/api/home-featured-lists", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => Array.isArray(body.lists) ? body.lists as FeaturedList[] : []);
    featuredListsRequest = request;
    void request.finally(() => {
      if (featuredListsRequest === request) featuredListsRequest = null;
    }).catch(() => {});
  }
  return featuredListsRequest;
}

export default function AdminFeaturedLists() {
  const [lists, setLists] = useState<FeaturedList[]>([]);
  const [movieStills, setMovieStills] = useState<Record<number, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastWheelChange = useRef(0);
  const suppressSwipeClick = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadFeaturedLists().then((next) => {
      if (cancelled) return;
      setLists(next);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const movieIds = [...new Set(lists.flatMap((featured) => featured.items
      .filter((item) => item.media_type === "movie")
      .map((item) => item.media_id)))];
    let cancelled = false;
    void Promise.all(movieIds.map(async (id) => {
      try {
        const details = await getMovieDetails(id);
        const still = details?.backdrop_gallery_urls?.[0] || details?.backdrop_url;
        return still ? [id, still] as const : null;
      } catch {
        return null;
      }
    })).then((results) => {
      if (cancelled) return;
      setMovieStills(Object.fromEntries(results.filter((entry): entry is readonly [number, string] => Boolean(entry))));
    });
    return () => { cancelled = true; };
  }, [lists]);

  useEffect(() => {
    if (lists.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setActiveIndex((current) => (current + 1) % lists.length);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [lists.length, activeIndex]);

  const moveList = (direction: number) => {
    if (lists.length < 2) return;
    setActiveIndex((current) => (current + direction + lists.length) % lists.length);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    moveList(dx < 0 ? 1 : -1);
    suppressSwipeClick.current = true;
    window.setTimeout(() => { suppressSwipeClick.current = false; }, 400);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (lists.length < 2) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const now = Date.now();
    if (Math.abs(delta) < 8 || now - lastWheelChange.current < 650) return;
    lastWheelChange.current = now;
    moveList(delta > 0 ? 1 : -1);
  };

  if (!lists.length) return null;
  const list = lists[activeIndex % lists.length];
  const renderList = (featured: FeaturedList) => {
    const hasExplicitFrames = featured.items.some((item) => typeof item.show_in_preview === "boolean");
    const selectedFrames = featured.items.filter((item) => item.media_type === "movie" && item.show_in_preview);
    const covers = (hasExplicitFrames ? selectedFrames : featured.items.filter((item) => item.media_type === "movie")).slice(0, 3);
    const listHref = `/lists/canisterr_${featured.id}`;
    const perforations = Array.from({ length: 14 }, (_, index) => <span key={index} className="h-1.5 w-2 shrink-0 rounded-[2px] bg-[#d8d0bb]/70 sm:h-2 sm:w-2.5" />);
    return <article key={featured.id} className="mx-auto w-full max-w-2xl py-1" aria-live="polite">
      <div className="flex flex-col gap-2 px-2 sm:gap-3">
        <div className="min-w-0 w-full text-center">
          <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#ff9b52]">Canister collection</p>
          <h2 className="mt-1 truncate font-serif text-lg font-bold leading-tight text-[#f4efdf] sm:text-xl"><Link href={listHref} className="transition-colors hover:text-[#ffb36b]">{featured.title}</Link></h2>
        </div>
        <div className="overflow-hidden rounded-md border border-white/10 bg-[#080808] p-1.5 sm:p-2" aria-label={`${covers.length} featured movie stills`}>
          <div className="flex items-center justify-around gap-1 pb-1.5" aria-hidden="true">{perforations}</div>
          <div className="grid grid-cols-3 gap-1.5 bg-black">
          {covers.map((item) => {
            const still = item.media_type === "movie" ? movieStills[item.media_id] : undefined;
            const frame = item.frame_url || still;
            const image = frame || item.poster_url;
            return <Link key={`${item.media_type}:${item.media_id}`} href={listHref} prefetch={false} aria-label={`Open ${featured.title}`} className="group/still relative aspect-video min-w-0 overflow-hidden bg-[#1a1917]">
              {image ? <Image src={image} alt={item.title} fill sizes="250px" className={frame ? "object-cover transition duration-300 group-hover/still:scale-[1.04]" : "object-contain"}/> : <span className="grid h-full place-items-center p-2 text-center text-xs text-white/50">{item.title}</span>}
            </Link>;
          })}
          {Array.from({ length: Math.max(0, 3 - covers.length) }, (_, index) => <div key={`empty-${index}`} className="aspect-video bg-[#171614]" />)}
          </div>
          <div className="flex items-center justify-around gap-1 pt-1.5" aria-hidden="true">{perforations}</div>
        </div>
      </div>
    </article>;
  };
  return <section className="mb-5" aria-label="Featured lists" onTouchStart={(event) => { touchStart.current = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }} onTouchEnd={handleTouchEnd} onWheel={handleWheel} onClickCapture={(event) => { if (suppressSwipeClick.current) { event.preventDefault(); event.stopPropagation(); suppressSwipeClick.current = false; } }}>
    {list && renderList(list)}
    {lists.length > 1 && <nav className="mt-2 flex items-center justify-center gap-2" aria-label="Choose a featured list">
      {lists.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show list ${index + 1}: ${item.title}`} aria-current={activeIndex === index ? "true" : undefined} className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? "w-5 bg-[#ff7a1a]" : "w-1.5 bg-white/30 hover:bg-white/60"}`} />)}
    </nav>}
  </section>;
}
