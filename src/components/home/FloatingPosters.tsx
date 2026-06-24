"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { PosterItem } from "@/lib/posters";

type FloatingPostersProps = {
  posters: PosterItem[];
};

type PosterPlacement = {
  title: string;
  rotate: number;
  x: number;
  y: number;
  z: number;
  widthClassName: string;
  delay: number;
};

const placements: PosterPlacement[] = [
  {
    title: "Pather Panchali",
    rotate: -22,
    x: -520,
    y: 40,
    z: 1,
    widthClassName: "hidden lg:block lg:w-36 xl:w-40",
    delay: 0.05,
  },
  {
    title: "La La Land",
    rotate: -14,
    x: -390,
    y: 28,
    z: 2,
    widthClassName: "w-28 sm:w-32 lg:w-36 xl:w-40",
    delay: 0.1,
  },
  {
    title: "Barbie",
    rotate: -8,
    x: -255,
    y: 0,
    z: 3,
    widthClassName: "w-28 sm:w-32 lg:w-36 xl:w-40",
    delay: 0.2,
  },
  {
    title: "Project Hail Mary",
    rotate: -3,
    x: -125,
    y: -14,
    z: 4,
    widthClassName: "w-28 sm:w-32 lg:w-36 xl:w-40",
    delay: 0.35,
  },
  {
    title: "12 Angry Men",
    rotate: 2,
    x: 5,
    y: -24,
    z: 6,
    widthClassName: "w-28 sm:w-32 lg:w-36 xl:w-40",
    delay: 0.45,
  },
  {
    title: "The Dark Knight",
    rotate: 9,
    x: 145,
    y: -6,
    z: 5,
    widthClassName: "w-28 sm:w-32 lg:w-36 xl:w-40",
    delay: 0.55,
  },
  {
    title: "Casino Royale",
    rotate: 13,
    x: 285,
    y: 8,
    z: 4,
    widthClassName: "hidden sm:block sm:w-30 lg:w-34 xl:w-38",
    delay: 0.62,
  },
  {
    title: "Breaking Bad",
    rotate: 15,
    x: 420,
    y: 38,
    z: 3,
    widthClassName: "hidden md:block md:w-30 lg:w-34 xl:w-38",
    delay: 0.65,
  },
  {
    title: "Charulata",
    rotate: 20,
    x: 540,
    y: 44,
    z: 1,
    widthClassName: "hidden xl:block xl:w-36",
    delay: 0.72,
  },
];

function FallbackPoster({ title }: { title: string }) {
  return (
    <div className="flex aspect-[2/3] h-full w-full flex-col justify-end rounded-[1.7rem] border border-white/12 bg-[linear-gradient(180deg,#040404,#0c0c0c_55%,#120f0d)] p-4">
      <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-[#ff7a1a]/50 to-transparent" />
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f5efe3]">{title}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/35">Poster unavailable</p>
    </div>
  );
}

export default function FloatingPosters({ posters }: FloatingPostersProps) {
  const prefersReducedMotion = useReducedMotion();
  const posterMap = new Map(posters.map((poster) => [poster.title, poster]));
  const fanOutDelay = 1;

  return (
    <div className="relative mx-auto mt-6 mb-8 flex h-[12.5rem] w-full max-w-[1500px] items-center justify-center overflow-visible sm:mt-10 sm:mb-12 sm:h-[22rem] lg:h-[27rem] xl:h-[30rem]">
      {placements.map((placement) => {
        const poster = posterMap.get(placement.title) ?? {
          title: placement.title,
          source: "tmdb" as const,
          posterUrl: null,
        };

        return (
          <motion.div
            key={placement.title}
            initial={{
              opacity: 0,
              x: 0,
              y: 18,
              rotate: 0,
              scale: 0.9,
            }}
            animate={
              prefersReducedMotion
                ? {
                    opacity: 1,
                    x: placement.x,
                    y: placement.y,
                    rotate: placement.rotate,
                    scale: 1,
                  }
                : {
                    opacity: 1,
                    x: placement.x,
                    y: [placement.y, placement.y - 10, placement.y, placement.y + 4, placement.y],
                    rotate: placement.rotate,
                    scale: 1,
                  }
            }
            transition={{
              opacity: { duration: 0.45, delay: placement.delay },
              scale: {
                duration: 0.7,
                delay: prefersReducedMotion ? placement.delay : fanOutDelay + placement.delay * 0.35,
                ease: "easeOut",
              },
              x: {
                duration: 0.9,
                delay: prefersReducedMotion ? placement.delay : fanOutDelay + placement.delay * 0.35,
                ease: [0.22, 1, 0.36, 1],
              },
              rotate: {
                duration: 0.9,
                delay: prefersReducedMotion ? placement.delay : fanOutDelay + placement.delay * 0.35,
                ease: [0.22, 1, 0.36, 1],
              },
              y: prefersReducedMotion
                ? { duration: 0.9, delay: placement.delay, ease: "easeOut" }
                : {
                    duration: 10 + placement.delay * 4,
                    delay: fanOutDelay + 0.25 + placement.delay * 0.35,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  },
            }}
            whileHover={
              prefersReducedMotion
                ? undefined
                : {
                    scale: 1.04,
                    y: placement.y - 14,
                    boxShadow: "0 0 34px rgba(255, 122, 26, 0.32)",
                  }
            }
            style={{ zIndex: placement.z }}
            className={`group absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${placement.widthClassName}`}
          >
            <div
              className="pointer-events-none absolute -top-14 left-1/2 z-20 hidden -translate-x-1/2 opacity-0 transition duration-200 group-hover:-translate-y-1 group-hover:opacity-100 sm:block"
              style={{ transform: `translateX(-50%) rotate(${-placement.rotate}deg)` }}
            >
              <div className="relative rounded-2xl border border-[#ff7a1a]/28 bg-[#121212] px-4 py-2 text-center shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
                <p className="whitespace-nowrap text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#fff2df]">
                  {poster.title}
                </p>
                <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-[#ff7a1a]/28 bg-[#121212]" />
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/78 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.14),transparent_50%)]" />
              <div className="absolute inset-0 rounded-[1.7rem] ring-1 ring-inset ring-[#ff7a1a]/10" />
              {poster.posterUrl ? (
                <Image
                  src={poster.posterUrl}
                  alt={`${poster.title} poster`}
                  width={400}
                  height={600}
                  sizes="(max-width: 640px) 120px, (max-width: 1024px) 144px, 160px"
                  className="aspect-[2/3] h-auto w-full object-cover"
                />
              ) : (
                <FallbackPoster title={poster.title} />
              )}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 h-10 rounded-full bg-[#ff7a1a]/12 blur-2xl" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
