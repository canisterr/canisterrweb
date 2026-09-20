"use client";

import {
  ChevronRight,
  Clock3,
  Film,
  Flame,
  Languages,
  Repeat2,
  Star,
  Tv,
  UserRound,
  Video,
} from "lucide-react";
import ReactionDistributionBar from "./ReactionDistributionBar";
import { getReactionAverageLabel, type DetailedUserStats, type StatDistributionItem } from "@/lib/profile";
import { formatWatchDuration as formatDuration } from "@/lib/format";

interface StatsInsightsProps {
  stats: DetailedUserStats;
  onStatClick?: (type: "all" | "movie" | "tv" | "masterpiece" | "good" | "average" | "bad") => void;
  onTasteClick?: (type: "genre" | "actor" | "director" | "language", value: string) => void;
}

type StatClick = StatsInsightsProps["onStatClick"];

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff7a1a]">{eyebrow}</p>
        <h3 className="mt-1 text-xl font-black tracking-tight text-[#f5f0de] sm:text-2xl">{title}</h3>
      </div>
      {detail ? <p className="hidden max-w-xs text-right text-xs leading-5 text-white/35 sm:block">{detail}</p> : null}
    </div>
  );
}

function HeroMetric({ stats, onStatClick }: { stats: DetailedUserStats; onStatClick?: StatClick }) {
  const body = (
    <div className="group relative min-h-[230px] overflow-hidden rounded-[2rem] border border-[#ff7a1a]/35 bg-[#101010] p-6 text-left shadow-[0_22px_70px_rgba(0,0,0,0.32)] sm:p-8">
      <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-[#ff7a1a]/15 blur-3xl transition group-hover:bg-[#ff7a1a]/25" />
      <div className="absolute right-5 top-5 flex h-12 w-12 rotate-6 items-center justify-center rounded-2xl bg-[#ff7a1a] text-black shadow-[0_10px_30px_rgba(255,122,26,0.3)] transition group-hover:rotate-12">
        <Film className="h-6 w-6" />
      </div>
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/40">All-time diary</p>
          <p className="mt-4 text-6xl font-black leading-none tracking-[-0.06em] text-[#f5f0de] sm:text-7xl">{stats.totalLogged}</p>
          <p className="mt-2 text-sm font-semibold text-[#ff9b52]">titles logged and counting</p>
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-sm text-white/45">Open the complete diary</span>
          <ChevronRight className="h-5 w-5 text-[#ff7a1a] transition group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );

  return onStatClick ? (
    <button type="button" onClick={() => onStatClick("all")} className="h-full w-full">{body}</button>
  ) : body;
}

function FunMetric({ icon, label, value, caption, onClick, featured = false, tilt = "" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  caption: string;
  onClick?: () => void;
  featured?: boolean;
  tilt?: string;
}) {
  const content = (
    <div className={`group h-full min-h-[150px] rounded-[1.65rem] border p-5 text-left transition duration-300 hover:-translate-y-1 hover:rotate-0 ${tilt} ${featured ? "border-[#ff7a1a] bg-[#ff7a1a] text-black shadow-[0_18px_42px_rgba(255,122,26,0.18)]" : "border-white/10 bg-[#151515] text-[#f5f0de] hover:border-[#ff7a1a]/45"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${featured ? "text-black/55" : "text-white/35"}`}>{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${featured ? "bg-black/12" : "bg-[#ff7a1a]/12 text-[#ff8d3b]"}`}>{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{value}</p>
      <p className={`mt-2 text-xs ${featured ? "text-black/60" : "text-white/40"}`}>{caption}</p>
    </div>
  );

  return onClick ? <button type="button" onClick={onClick} className="h-full w-full">{content}</button> : content;
}

function MonthCard({ stats }: { stats: DetailedUserStats }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0e0e0e] p-5 sm:p-6">
      <div className="absolute left-8 top-0 h-2 w-16 rounded-b-full bg-[#ff7a1a]" />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">This month</p>
          <p className="mt-1 text-base font-bold text-[#f5f0de]">Your current watch mix</p>
        </div>
        <Flame className="h-5 w-5 text-[#ff7a1a]" />
      </div>
      <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 rounded-2xl bg-white/[0.045] py-4">
        <div className="px-4"><p className="text-3xl font-black text-[#f5f0de]">{stats.movieCountThisMonth}</p><p className="mt-1 text-xs text-white/40">Movies</p></div>
        <div className="px-4"><p className="text-3xl font-black text-[#f5f0de]">{stats.tvCountThisMonth}</p><p className="mt-1 text-xs text-white/40">TV shows</p></div>
      </div>
    </div>
  );
}

function VerdictBoard({ stats, onStatClick }: { stats: DetailedUserStats; onStatClick?: StatClick }) {
  const verdicts: Array<{ label: string; value: number; key: "bad" | "average" | "good" | "masterpiece" }> = [
    { label: "Bad", value: stats.badCount, key: "bad" },
    { label: "Average", value: stats.averageCount, key: "average" },
    { label: "Good", value: stats.goodCount, key: "good" },
    { label: "Masterpiece", value: stats.masterpieceCount, key: "masterpiece" },
  ];

  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#101010] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">Your verdict</p><p className="mt-2 text-2xl font-black tracking-tight text-[#f5f0de]">{getReactionAverageLabel(stats)}</p></div>
        <span className="flex h-11 w-11 -rotate-6 items-center justify-center rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 text-[#ff7a1a]"><Star className="h-5 w-5" /></span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {verdicts.map((item) => (
          <button key={item.key} type="button" onClick={onStatClick ? () => onStatClick(item.key) : undefined} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${item.key === "masterpiece" ? "border-[#ff7a1a]/45 bg-[#ff7a1a]/12" : "border-white/[0.07] bg-white/[0.035] hover:border-white/15"}`}>
            <p className="text-2xl font-black text-[#f5f0de]">{item.value}</p>
            <p className={`mt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${item.key === "masterpiece" ? "text-[#ff8d3b]" : "text-white/35"}`}>{item.label}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 border-t border-white/10 pt-5">
        <ReactionDistributionBar badCount={stats.badCount} averageCount={stats.averageCount} goodCount={stats.goodCount} masterpieceCount={stats.masterpieceCount} showLabels={false} theme="dark" onSegmentClick={onStatClick} />
      </div>
    </div>
  );
}

function TasteCard({ title, icon, items, onItemClick, showPortrait = false }: {
  title: string;
  icon: React.ReactNode;
  items: StatDistributionItem[];
  onItemClick?: (value: string) => void;
  showPortrait?: boolean;
}) {
  const rows = items.slice(0, 5);
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] p-5 transition hover:border-[#ff7a1a]/25 sm:p-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <h4 className="text-base font-black text-[#f5f0de]">{title}</h4>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff7a1a]/12 text-[#ff8d3b]">{icon}</span>
      </div>
      <div className="mt-2">
        {rows.length ? rows.map((item, index) => {
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-[10px] font-black text-white/25">0{index + 1}</span>
                {showPortrait ? (item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover grayscale transition group-hover:grayscale-0" />
                ) : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-black text-white/45">{item.label.charAt(0)}</span>) : null}
                <span className="truncate text-sm font-semibold text-white/70 transition group-hover:text-[#f5f0de]">{item.label}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-[#ff9b52]">{item.count}</span>
            </>
          );
          return onItemClick ? <button key={item.label} type="button" onClick={() => onItemClick(item.label)} className="group flex w-full items-center justify-between gap-3 border-b border-white/[0.06] py-3 text-left last:border-0">{row}</button> : <div key={item.label} className="group flex items-center justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0">{row}</div>;
        }) : <p className="py-8 text-center text-sm text-white/35">Log a few titles to unlock this.</p>}
      </div>
    </div>
  );
}

export default function StatsInsights({ stats, onStatClick, onTasteClick }: StatsInsightsProps) {
  return (
    <div className="mb-10 px-1 py-4 sm:px-4 sm:py-6">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-black tracking-[-0.04em] text-[#f5f0de] sm:text-4xl">The story behind your screen time.</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/40">A playful snapshot of what you watch, love, and return to.</p>
      </div>

      <section>
        <SectionTitle eyebrow="Overview" title="At a glance" detail="Your lifetime activity and this month’s momentum." />
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroMetric stats={stats} onStatClick={onStatClick} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <FunMetric icon={<Clock3 className="h-4 w-4" />} label="Watch time" value={formatDuration(stats.estimatedWatchTimeMinutes)} caption="Estimated runtime" tilt="sm:-rotate-1" />
            <FunMetric icon={<Repeat2 className="h-4 w-4" />} label="Rewatches" value={stats.rewatchCount} caption="Worth another go" tilt="sm:rotate-1" />
            <FunMetric icon={<Film className="h-4 w-4" />} label="Movies" value={stats.movieCount} caption="Feature films" onClick={onStatClick ? () => onStatClick("movie") : undefined} />
            <FunMetric icon={<Tv className="h-4 w-4" />} label="TV shows" value={stats.tvCount} caption="Series tracked" featured onClick={onStatClick ? () => onStatClick("tv") : undefined} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <MonthCard stats={stats} />
          <VerdictBoard stats={stats} onStatClick={onStatClick} />
        </div>
      </section>

      <section className="mt-10 border-t border-white/10 pt-8">
        <SectionTitle eyebrow="Taste map" title="Your recurring favorites" detail="The people, genres, and languages shaping your diary." />
        <div className="grid gap-4 lg:grid-cols-2">
          <TasteCard title="Genres" icon={<Flame className="h-4 w-4" />} items={stats.genreDistribution} onItemClick={onTasteClick ? (value) => onTasteClick("genre", value) : undefined} />
          <TasteCard title="Actors" icon={<UserRound className="h-4 w-4" />} items={stats.topActors} showPortrait onItemClick={onTasteClick ? (value) => onTasteClick("actor", value) : undefined} />
          <TasteCard title="Directors" icon={<Video className="h-4 w-4" />} items={stats.topDirectors} showPortrait onItemClick={onTasteClick ? (value) => onTasteClick("director", value) : undefined} />
          <TasteCard title="Languages" icon={<Languages className="h-4 w-4" />} items={stats.languageDistribution} onItemClick={onTasteClick ? (value) => onTasteClick("language", value) : undefined} />
        </div>
      </section>
    </div>
  );
}
