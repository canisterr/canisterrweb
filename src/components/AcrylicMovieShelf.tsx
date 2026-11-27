"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type AcrylicMovieShelfItem = {
  key: string;
  href?: string;
  title: string;
  posterUrl: string | null;
  typeLabel?: string;
  accentLabel?: string | null;
  meta?: ReactNode;
};

type AcrylicMovieShelfProps = {
  title: string;
  items: AcrylicMovieShelfItem[];
  shelfColor?: string;
  countLabel?: string;
  emptyLabel?: string;
};

const fallbackPoster =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='342' height='513'%3E%3Crect fill='%23111111' width='342' height='513'/%3E%3C/svg%3E";

function RailButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Scroll ${direction}`}
      className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#f5f0de] transition hover:border-[#ffb36b]/40 hover:text-[#ffb36b] disabled:cursor-default disabled:opacity-30 sm:inline-flex"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function AcrylicMovieShelf({
  title,
  items,
  shelfColor = "rgba(101, 191, 255, 0.64)",
  countLabel,
  emptyLabel = "No titles here yet.",
}: AcrylicMovieShelfProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateScrollState = () => {
      const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
      setCanScrollLeft(rail.scrollLeft > 8);
      setCanScrollRight(maxScrollLeft - rail.scrollLeft > 8);
    };

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateScrollState)
      : null;
    resizeObserver?.observe(rail);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [items.length]);

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = Math.max(rail.clientWidth * 0.78, 260) * direction;
    rail.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-5 border-t border-white/8 pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-[#f5f0de] sm:text-[2rem]">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <p className="whitespace-nowrap text-sm font-bold text-[#ffb36b]">
            {countLabel ?? `${items.length} movies`}
          </p>
          <div className="flex items-center gap-2">
            <RailButton direction="left" disabled={!canScrollLeft} onClick={() => scrollRail(-1)} />
            <RailButton direction="right" disabled={!canScrollRight} onClick={() => scrollRail(1)} />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-[#f5f0de]/45">{emptyLabel}</p>
      ) : (
        <div
          ref={railRef}
          className="scrollbar-hide -mx-2 overflow-x-auto px-2 pb-2 overscroll-x-contain scroll-smooth"
        >
          <div className="relative h-[18.05rem] w-max min-w-full sm:h-[19.7rem] lg:h-[21.4rem]">
            <div className="flex items-start gap-4 pr-2">
              {items.map((item) => {
                const poster = (
                  <div className="relative flex h-[14.2rem] w-[9rem] items-end justify-center sm:h-[15.7rem] sm:w-[10rem] lg:h-[17.2rem] lg:w-[11rem]">
                    <div className="pointer-events-none absolute inset-x-3 bottom-7 h-6 rounded-full bg-black/28 blur-xl" />
                    <div className="relative z-10 h-[13.5rem] w-[9rem] overflow-hidden rounded-[1rem] border border-white/10 bg-[#111111] shadow-[0_18px_28px_rgba(0,0,0,0.28)] transition duration-300 group-hover/item:-translate-y-2 group-hover/item:shadow-[0_28px_40px_rgba(0,0,0,0.34)] sm:h-[15rem] sm:w-[10rem] lg:h-[16.5rem] lg:w-[11rem]">
                      <img
                        src={item.posterUrl || fallbackPoster}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover/item:scale-[1.03]"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      {(item.typeLabel || item.accentLabel) && (
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                          {item.typeLabel ? (
                            <span className="rounded-full border border-white/14 bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/82">
                              {item.typeLabel}
                            </span>
                          ) : null}
                          {item.accentLabel ? (
                            <span className="rounded-full border border-[#ffcf93]/35 bg-black/58 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#ffcf93]">
                              {item.accentLabel}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );

                return (
                  <article
                    key={item.key}
                    className="group/item shrink-0 snap-start"
                  >
                    {item.href ? (
                      <Link href={item.href} prefetch={false} aria-label={item.title} className="block cursor-pointer">
                        {poster}
                      </Link>
                    ) : (
                      poster
                    )}

                    {item.meta ? <div className="mt-3 w-[9rem] px-1 sm:w-[10rem] lg:w-[11rem]">{item.meta}</div> : null}
                  </article>
                );
              })}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-[14.2rem] z-20 h-[3.85rem] sm:top-[15.7rem] sm:h-[4rem] lg:top-[17.2rem] lg:h-[4.2rem]">
              <div
                className="absolute inset-x-0 bottom-0 top-0 overflow-hidden rounded-[1.45rem] border border-white/20 shadow-[0_14px_28px_rgba(0,0,0,0.2)] backdrop-blur-[10px]"
                style={{
                  background: `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, ${shelfColor} 22%, ${shelfColor} 100%)`,
                }}
              >
                <div className="absolute inset-x-4 top-1 h-px bg-white/65" />
                <div className="absolute inset-x-10 top-2 h-4 rounded-full bg-white/18 blur-md" />
                <div className="absolute inset-x-6 bottom-1.5 h-5 rounded-full bg-black/10 blur-lg" />
              </div>

              <div className="absolute left-3 top-1/2 z-30 h-4 w-4 -translate-y-1/2 rounded-full border border-white/28 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.98),rgba(198,205,215,0.75)_30%,rgba(85,92,105,0.9)_100%)] shadow-[0_2px_5px_rgba(0,0,0,0.25)] sm:left-4" />
              <div className="absolute right-3 top-1/2 z-30 h-4 w-4 -translate-y-1/2 rounded-full border border-white/28 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.98),rgba(198,205,215,0.75)_30%,rgba(85,92,105,0.9)_100%)] shadow-[0_2px_5px_rgba(0,0,0,0.25)] sm:right-4" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
