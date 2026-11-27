"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";
import type { MovieLog, MovieLogWithContent, User } from "@/types";
import { getOnThisDayMemories } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";
import { formatYearsAgo, type OnThisDayMemory } from "@/lib/on-this-day";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function reactionLabel(log: MovieLogWithContent): string | null {
  if (log.reaction === 2) return "Masterpiece";
  if (log.reaction === 1.5) return "Average";
  if (log.reaction === 1) return "Good";
  if (log.reaction === 0) return "Bad";
  return null;
}

export default function OnThisDay({ user, logs }: { user: User; logs: MovieLog[] }) {
  const [memories, setMemories] = useState<OnThisDayMemory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();

    void getOnThisDayMemories(user.id, today, user, logs)
      .then((matchingMemories) => {
        if (!cancelled) setMemories(matchingMemories);
      })
      .catch(() => {
        if (!cancelled) setMemories([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user, logs]);

  if (!memories?.length) return null;
  const { log, yearsAgo } = memories[0];
  const [, month, day] = log.watched_date.split("-").map(Number);
  const posterUrl = getTmdbPosterUrl(log.content.poster_url, "w185");
  const reaction = reactionLabel(log);

  return (
    <section className="mb-6 overflow-hidden border border-white/10 bg-[#1d211f]" aria-labelledby="on-this-day-heading">
      <Link href={buildLogUrl(log)} className="group flex min-w-0 items-center gap-3 p-3 transition hover:bg-white/[0.04] sm:gap-4 sm:p-4">
        <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden bg-white/[0.05] sm:w-16">
          {posterUrl ? (
            <Image src={posterUrl} alt="" fill sizes="(max-width: 639px) 56px, 64px" className="object-cover transition duration-300 group-hover:scale-[1.04]" placeholder="blur" blurDataURL={getBlurDataUrl()} />
          ) : <Film className="absolute inset-0 m-auto h-5 w-5 text-white/20" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <h2 id="on-this-day-heading" className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8c3a8]">On this day <span className="text-white/45">· {MONTHS[month - 1]} {day}</span></h2>
          <span className="mt-1 block text-xs font-semibold text-white/55">{formatYearsAgo(yearsAgo)}, you watched</span>
          <span className="mt-0.5 block break-words text-lg font-black leading-tight text-[#f5f0de] sm:text-xl">{log.content.title}</span>
          {reaction ? <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">You called it {reaction}</span> : null}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#d8c3a8]" aria-hidden="true" />
      </Link>
    </section>
  );
}
