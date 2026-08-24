"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { BookmarkPlus, Check, Info, X } from "lucide-react";
import type { DiscoveryAction, DiscoveryMovie } from "@/lib/discovery/discoveryTypes";

const DISTANCE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 700;

function formatRuntime(runtime?: number | null) {
  if (!runtime) return null;
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function SwipePosterCard({
  movie,
  active,
  stackIndex,
  onSwipe,
  onDetails,
}: {
  movie: DiscoveryMovie;
  active: boolean;
  stackIndex: number;
  onSwipe: (action: DiscoveryAction) => void;
  onDetails: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 0, 180], [-8, 0, 8]);
  const interestedOpacity = useTransform(x, [30, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -30], [1, 0]);
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
  const year = movie.release_date?.slice(0, 4);
  const runtime = formatRuntime(movie.runtime);
  const scale = 1 - stackIndex * 0.045;
  const y = stackIndex * 13;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > DISTANCE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      onSwipe("interested");
      return;
    }
    if (info.offset.x < -DISTANCE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      onSwipe("pass");
    }
  };

  return (
    <motion.div
      className="absolute inset-x-0 top-0"
      style={{ zIndex: 10 - stackIndex }}
      initial={false}
      animate={{ scale, y, opacity: stackIndex > 2 ? 0 : 1 }}
      exit={{ x: active ? x.get() || 0 : 0, opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <motion.button
        type="button"
        onClick={onDetails}
        aria-label={`Open details for ${movie.title}`}
        className="swipe-card relative aspect-[2/3] w-full cursor-grab overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#111] text-left shadow-[0_30px_90px_rgba(0,0,0,0.55)] active:cursor-grabbing"
        drag={active ? "x" : false}
        dragDirectionLock
        dragElastic={0.12}
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x: active ? x : 0, rotate: active ? rotate : 0, touchAction: "pan-y" }}
        onDragEnd={handleDragEnd}
        whileTap={active ? { scale: 0.985 } : undefined}
      >
        {posterUrl ? (
          <Image src={posterUrl} alt={movie.title} fill priority={active} sizes="(max-width: 640px) 88vw, 360px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/[0.04] px-6 text-center text-sm text-white/45">
            No poster available
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/78 to-transparent p-5 pt-24">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-2xl font-black leading-tight text-[#f5f0de]">{movie.title}</h2>
              <p className="mt-1 text-sm font-semibold text-white/68">{[year, runtime].filter(Boolean).join(" • ")}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 p-2 text-white/75">
              <Info className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {movie.moodTags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold text-[#f5f0de] backdrop-blur">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {active ? (
          <>
            <motion.div style={{ opacity: interestedOpacity }} className="absolute right-5 top-5 rounded-full border border-[#34c759]/25 bg-[#34c759]/18 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#d8ffe3] backdrop-blur">
              Interested
            </motion.div>
            <motion.div style={{ opacity: passOpacity }} className="absolute left-5 top-5 rounded-full border border-white/15 bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f5f0de] backdrop-blur">
              Pass
            </motion.div>
          </>
        ) : null}
      </motion.button>
    </motion.div>
  );
}

export default function SwipeDeck({
  movies,
  moodName,
  remainingCount,
  onSwipe,
  onWatchlist,
  onDetails,
}: {
  movies: DiscoveryMovie[];
  moodName: string;
  remainingCount: number;
  onSwipe: (movie: DiscoveryMovie, action: DiscoveryAction) => void;
  onWatchlist: (movie: DiscoveryMovie) => void;
  onDetails: (movie: DiscoveryMovie) => void;
}) {
  const visible = movies.slice(0, 3);
  const activeMovie = visible[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeMovie) return;
      if (event.key === "ArrowLeft") onSwipe(activeMovie, "pass");
      if (event.key === "ArrowRight") onSwipe(activeMovie, "interested");
      if (event.key.toLowerCase() === "w") onWatchlist(activeMovie);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMovie, onSwipe, onWatchlist]);

  if (!activeMovie) return null;

  return (
    <section className="discovery-page mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col px-0 pb-5 pt-3 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/38">Discover</p>
      <p className="mt-2 text-sm font-semibold text-[#f5f0de]">Your mood: {moodName}</p>

      <div className="swipe-area relative mx-auto mt-5 w-full max-w-[360px] px-5">
        <div className="relative aspect-[2/3] w-full">
          <AnimatePresence initial={false}>
            {visible.map((movie, index) => (
              <SwipePosterCard
                key={movie.id}
                movie={movie}
                active={index === 0}
                stackIndex={index}
                onSwipe={(action) => onSwipe(movie, action)}
                onDetails={() => onDetails(movie)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 px-5">
        <button type="button" onClick={() => onSwipe(activeMovie, "pass")} className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-sm font-black text-[#f5f0de]">
          <X className="h-5 w-5" />
          Pass
        </button>
        <button type="button" onClick={() => onWatchlist(activeMovie)} className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/10 bg-[#f5f0de] text-sm font-black text-[#0a0a0a]">
          <BookmarkPlus className="h-5 w-5" />
          Save
        </button>
        <button type="button" onClick={() => onSwipe(activeMovie, "interested")} className="flex h-14 items-center justify-center gap-2 rounded-full border border-[#34c759]/30 bg-[#34c759] text-sm font-black text-[#08120b]">
          <Check className="h-5 w-5" />
          Pick
        </button>
      </div>

      <p className="mt-4 text-xs font-semibold text-white/38">{remainingCount} movies left</p>
    </section>
  );
}
