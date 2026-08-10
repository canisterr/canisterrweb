"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Box, RefreshCw } from "lucide-react";
import { getShelfPosterUrl } from "@/lib/store/discover";
import { useStoreSectionMovies } from "@/hooks/store/useStoreSectionMovies";
import { useStoreScene } from "@/lib/store/store-state";
import { GENRE_SECTIONS, COLLECTION_SECTIONS } from "@/lib/store/shelf-config";
import { PERSONALIZED_SECTIONS } from "@/lib/store/personalized-config";
import { trackStoreEvent } from "@/lib/store/analytics";
import type { PersonalizedSectionConfig, StoreSectionConfig } from "@/types/store";
import type { User } from "@/types";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

interface SectionRowProps {
  section: StoreSectionConfig | PersonalizedSectionConfig;
  userId: string | null;
  onSelectMovie: (movieId: number) => void;
}

function SectionRow({ section, userId, onSelectMovie }: SectionRowProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { shelves, requiresSignIn } = useStoreSectionMovies(section, userId, inView);
  const hasAnyMovies = shelves.some((shelf) => shelf.movies.length > 0);

  return (
    <div ref={ref} className="mb-8">
      <h2 className="mb-3 text-lg font-black tracking-tight text-[#f5f0de]">{section.label}</h2>
      {requiresSignIn ? (
        <p className="text-sm text-[#f5f0de]/50">Sign in to unlock this section.</p>
      ) : inView && !hasAnyMovies ? (
        <p className="text-sm text-[#f5f0de]/40">Loading…</p>
      ) : (
        shelves.map((shelf) =>
          shelf.movies.length > 0 ? (
            <div key={shelf.id} className="mb-4">
              <p className="mb-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#f5f0de]/45">{shelf.label}</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {shelf.movies.map((movie) => {
                  const posterUrl = movie.posterPath || movie.posterUrl ? getShelfPosterUrl(movie, "w185") : null;
                  return (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => onSelectMovie(movie.id)}
                      className="w-24 shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a] text-left transition hover:ring-2 hover:ring-[#ff7a1a]/60"
                    >
                      {posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterUrl} alt={movie.title} loading="lazy" className="aspect-[2/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center p-1.5 text-center text-[10px] text-[#f5f0de]/50">
                          {movie.title}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null
        )
      )}
    </div>
  );
}

const ALL_SECTIONS: (StoreSectionConfig | PersonalizedSectionConfig)[] = [
  ...PERSONALIZED_SECTIONS,
  ...COLLECTION_SECTIONS,
  ...GENRE_SECTIONS,
];

interface SimpleStoreViewProps {
  user: User | null;
  onSelectMovie: (movieId: number) => void;
  onSwitchTo3D?: () => void;
}

/** Non-3D fallback: the same sections/shelves as flat, lazily-loaded scrollable rows. */
export default function SimpleStoreView({ user, onSelectMovie, onSwitchTo3D }: SimpleStoreViewProps) {
  const refreshShelves = useStoreScene((s) => s.refreshShelves);

  useEffect(() => {
    trackStoreEvent("store_simple_view_opened");
  }, []);

  return (
    <div className="min-h-dvh bg-[#0a0a0a] px-4 pb-16 pt-4 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[#f5f0de]/70 transition hover:text-[#f5f0de]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Canisterr
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                refreshShelves();
                trackStoreEvent("store_shelves_refreshed");
              }}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
              aria-label="Refresh shelves to see other movies"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
            </button>
            {onSwitchTo3D && (
              <button
                type="button"
                onClick={onSwitchTo3D}
                className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50"
              >
                <Box className="h-4 w-4" aria-hidden="true" /> Enter 3D Store
              </button>
            )}
          </div>
        </div>
        <h1 className="mb-8 text-3xl font-black tracking-tight text-[#f5f0de]">The Canisterr Store</h1>
        {ALL_SECTIONS.map((section) => (
          <SectionRow key={section.id} section={section} userId={user?.id ?? null} onSelectMovie={onSelectMovie} />
        ))}
      </div>
    </div>
  );
}
