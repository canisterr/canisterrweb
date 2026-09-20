"use client";

import Image from "next/image";
import { Bookmark, Check, ChevronRight, Clock3, Eye, RefreshCw, Sparkles, ThumbsDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { RankedRecommendation, RecommendationFeedbackAction } from "@/lib/recommendation/types";

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder ? `${remainder}m` : ""}`.trim() : `${minutes}m`;
}

const laneCopy = {
  safe: "Safe bet",
  stretch: "The stretch",
  wildcard: "Wildcard",
} as const;

export default function RecommendationCard({
  recommendation,
  busyAction,
  saved,
  onAction,
}: {
  recommendation: RankedRecommendation;
  busyAction: RecommendationFeedbackAction | "save" | null;
  saved: boolean;
  onAction: (action: RecommendationFeedbackAction | "save") => void;
}) {
  const reduceMotion = useReducedMotion();
  const { candidate } = recommendation;
  const year = candidate.releaseDate?.slice(0, 4);
  const runtime = formatRuntime(candidate.runtimeMinutes);
  const metadata = [year, candidate.contentType === "tv" ? "Series" : "Movie", runtime].filter(Boolean).join(" • ");

  return (
    <motion.article
      key={`${candidate.contentType}:${candidate.id}`}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] shadow-[0_28px_90px_rgba(0,0,0,0.42)] sm:rounded-[2rem]"
    >
      <div className="relative min-h-[27rem] sm:min-h-[34rem]">
        {candidate.backdropUrl || candidate.posterUrl ? (
          <Image
            src={candidate.backdropUrl || candidate.posterUrl || ""}
            alt={candidate.title}
            fill
            preload
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#171717]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/68 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#ff7a1a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-black">{laneCopy[recommendation.lane]}</span>
            <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 backdrop-blur">For tonight</span>
          </div>
          <h2 className="max-w-3xl text-3xl font-black leading-[0.98] tracking-[-0.045em] text-[#f5f0de] sm:text-5xl">{candidate.title}</h2>
          <p className="mt-3 text-sm font-semibold text-white/55">{metadata}</p>
          <div className="mt-5 flex items-center gap-4">
            <div>
              <p className="text-4xl font-black tracking-[-0.05em] text-[#ff7a1a]">{recommendation.tonightMatch}%</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Match tonight</p>
            </div>
            <div className="h-11 w-px bg-white/12" />
            <p className="max-w-xl text-sm leading-6 text-white/70">{recommendation.reason}</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr]">
          <button type="button" onClick={() => onAction("accepted")} disabled={Boolean(busyAction)} className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-5 text-sm font-black text-black transition hover:bg-[#ff8d3b] disabled:opacity-50 sm:col-span-1">
            <Check className="h-4 w-4" /> Watch this <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onAction("another")} disabled={Boolean(busyAction)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busyAction === "another" ? "animate-spin" : ""}`} /> Another
          </button>
          <button type="button" onClick={() => onAction("save")} disabled={Boolean(busyAction) || saved} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:opacity-55">
            <Bookmark className="h-4 w-4" /> {saved ? "Saved" : "Save"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-white/[0.07] pt-3">
          <button type="button" onClick={() => onAction("seen")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white/45 transition hover:bg-white/5 hover:text-white/75"><Eye className="h-3.5 w-3.5" /> Seen it</button>
          <button type="button" onClick={() => onAction("not_tonight")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white/45 transition hover:bg-white/5 hover:text-white/75"><Clock3 className="h-3.5 w-3.5" /> Not tonight</button>
          <button type="button" onClick={() => onAction("not_for_me")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white/45 transition hover:bg-white/5 hover:text-white/75"><ThumbsDown className="h-3.5 w-3.5" /> Not for me</button>
        </div>
        {candidate.providerNames.length ? (
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-white/35"><Sparkles className="h-3 w-3 text-[#ff7a1a]" /> Availability found on {candidate.providerNames.slice(0, 3).join(", ")}</p>
        ) : null}
      </div>
    </motion.article>
  );
}
