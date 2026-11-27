"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import type { CrewWorkCardData } from "@/lib/crew";

type CrewWorkCardProps = {
  item: CrewWorkCardData;
};

export default function CrewWorkCard({ item }: CrewWorkCardProps) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      className="group flex h-full gap-4 border-b border-white/10 py-5 transition hover:bg-white/[0.02]"
    >
      <div className="relative h-[132px] w-[88px] flex-shrink-0 overflow-hidden border border-white/10 bg-[#191919]">
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            sizes="88px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.14em] text-white/35">
            No poster
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
          {item.mediaType === "tv" ? "TV Show" : "Movie"}  •  {item.yearLabel}
        </p>

        <h3 className="mt-3 text-lg font-semibold leading-tight text-[#f5f0de] transition group-hover:text-white">
          {item.title}
        </h3>

        <p className="mt-2 text-sm text-[#ffb36b]">{item.jobs.join(" • ") || "Crew"}</p>

        {item.characters.length > 0 ? (
          <p className="mt-1 text-sm text-white/72">as {item.characters.join(", ")}</p>
        ) : null}

        {item.overview ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/58">{item.overview}</p>
        ) : null}
      </div>
    </Link>
  );
}
