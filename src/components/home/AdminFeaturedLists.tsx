"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import type { FeaturedList } from "@/lib/featured-lists";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
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
    if (lists.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        const step = window.matchMedia("(min-width: 640px)").matches ? 2 : 1;
        setActiveIndex((current) => (current + step) % lists.length);
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [lists.length]);

  if (!lists.length) return null;
  const list = lists[activeIndex % lists.length];
  const desktopStart = Math.floor(activeIndex / 2) * 2;
  const desktopLists = lists.slice(desktopStart, desktopStart + 2);
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || lists.length < 2) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    setActiveIndex((current) => (current + (distance < 0 ? 1 : lists.length - 1)) % lists.length);
    suppressSwipeClick.current = true;
    window.setTimeout(() => { suppressSwipeClick.current = false; }, 400);
  };
  const handleSwipeClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressSwipeClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressSwipeClick.current = false;
  };
  const renderList = (featured: FeaturedList) => {
    const covers = featured.items.slice(0, 3);
    const listHref = `/lists/canisterr_${featured.id}`;
    return <article key={featured.id} className="py-1" aria-live="polite">
      <div className="flex flex-col items-center gap-2 px-2 sm:gap-3">
        <div className="relative mx-auto h-[145px] w-[220px] shrink-0 sm:h-[168px] sm:w-[250px]" aria-label={`${covers.length} featured posters`}>
          {covers.map((item, index) => {
            const positions = [
              "left-1/2 top-0 z-20 -translate-x-1/2",
              "left-[4%] top-5 z-10 -rotate-[9deg] sm:left-[7%]",
              "right-[4%] top-5 z-10 rotate-[9deg] sm:right-[7%]",
            ];
            return <Link key={`${item.media_type}:${item.media_id}`} href={listHref} aria-label={`Open ${featured.title}`} style={{ zIndex: index === 0 ? 20 : 10 }} className={`absolute h-[120px] w-[80px] overflow-hidden border border-[#f4efdf]/35 bg-[#1a1917] shadow-[0_7px_14px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-1 sm:h-[140px] sm:w-[94px] ${positions[index] || "hidden"}`}>
              {item.poster_url ? <Image src={item.poster_url} alt={item.title} fill sizes="114px" className="object-cover"/> : <span className="grid h-full place-items-center p-2 text-center text-xs text-white/50">{item.title}</span>}
            </Link>;
          })}
          {covers.length === 0 && <div className="h-full w-full border border-white/10 bg-[#171614]"/>}
        </div>
        <div className="min-w-0 w-full text-center">
          <p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#ff9b52]">A Canisterr selection</p>
          <h2 className="mt-1 font-serif text-lg font-bold leading-tight text-[#f4efdf] sm:text-xl"><Link href={listHref} className="transition-colors hover:text-[#ffb36b]">{featured.title}</Link></h2>
          {featured.description && <p className="mx-auto mt-1 max-w-xl text-[11px] leading-4 text-white/55">{featured.description}</p>}
        </div>
      </div>
    </article>;
  };
  return <section className="mb-5" aria-label="Featured lists">
    {list && <div className="touch-pan-y select-none sm:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClickCapture={handleSwipeClick}>{renderList(list)}</div>}
    <div className="hidden grid-cols-2 items-start gap-3 sm:grid lg:gap-5">
      {desktopLists.map(renderList)}
    </div>
    {lists.length > 1 && <nav className="mt-2 flex items-center justify-center gap-2" aria-label="Choose a featured list">
      {lists.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show list ${index + 1}: ${item.title}`} aria-current={activeIndex === index ? "true" : undefined} className={`h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? "w-5 bg-[#ff7a1a]" : "w-1.5 bg-white/30 hover:bg-white/60"}`} />)}
      <span className="ml-1 text-[10px] tabular-nums text-white/45">{String(activeIndex + 1).padStart(2, "0")} / {String(lists.length).padStart(2, "0")}</span>
    </nav>}
  </section>;
}
