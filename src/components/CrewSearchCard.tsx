"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import { buildCrewPath, getCrewKnownWorks } from "@/lib/crew";
import type { TMDBPersonSearchResult } from "@/types";

type CrewSearchCardProps = {
  person: TMDBPersonSearchResult;
  href?: string;
  onClick?: () => void;
};

export default function CrewSearchCard({ person, href, onClick }: CrewSearchCardProps) {
  const knownWorks = getCrewKnownWorks(person, 3);
  const targetHref = href || buildCrewPath(person);
  const profileImage = person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : null;

  return (
    <Link
      href={targetHref}
      prefetch={false}
      onClick={onClick}
      className="flex items-center gap-3 border-b border-white/10 p-3 transition-colors hover:bg-white/5"
    >
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden border border-white/10 bg-[#171717]">
        {profileImage ? (
          <Image
            src={profileImage}
            alt={person.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/45">
            {person.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f5f0de] sm:text-base">{person.name}</p>
        <p className="mt-0.5 truncate text-xs uppercase tracking-[0.16em] text-[#ffb36b]">
          {person.known_for_department || "Film / TV"}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-white/55 sm:text-sm">
          {knownWorks.length > 0 ? `Known for ${knownWorks.join(", ")}` : "Open the full career timeline"}
        </p>
      </div>
    </Link>
  );
}
