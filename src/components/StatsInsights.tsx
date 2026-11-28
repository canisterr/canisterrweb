"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { getReactionAverageLabel, type DetailedUserStats, type StatDistributionItem } from "@/lib/profile";
import { formatWatchDuration } from "@/lib/format";
import styles from "./home/HomeStatsBento.module.css";

interface StatsInsightsProps {
  stats: DetailedUserStats;
  onStatClick?: (type: "all" | "movie" | "tv" | "masterpiece" | "good" | "average" | "bad") => void;
  onTasteClick?: (type: "genre" | "actor" | "director" | "language", value: string) => void;
  filterAction?: ReactNode;
}

const CARD = "min-w-0 overflow-hidden rounded-xl border sm:rounded-2xl";
const SURFACE = {
  carbon: "border-[#f5f0de]/15 bg-[#0e0d0b]",
  charcoal: "border-[#f5f0de]/10 bg-[#1c1a17]",
  orange: "border-[#c45b2a] bg-[#c45b2a]",
  cream: "border-[#f5f0de] bg-[#f5f0de]",
};
const LABEL = "text-[10px] font-black uppercase tracking-[0.2em] text-[#f5f0de]/45 sm:text-xs";

type StatsTone = keyof typeof SURFACE;

function MetricCard({ label, value, tone, onClick }: { label: string; value: string | number; tone: StatsTone; onClick?: () => void }) {
  const className = `flex h-28 flex-col items-center justify-center p-2 text-center transition-colors sm:h-32 sm:p-3 lg:h-36 ${onClick ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c45b2a]" : ""}`;
  const content = <>
    <span className={`text-[9px] font-black uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.18em] ${tone === "orange" ? "text-[#ff7a1a]" : "text-[#f5f0de]/50"}`}>{label}</span>
    <span className={`mt-2 text-3xl font-black leading-none tracking-normal sm:text-5xl ${tone === "orange" ? "text-[#ff7a1a]" : "text-[#f5f0de]"}`}>{value}</span>
  </>;
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function RatingDistribution({ stats, onStatClick }: { stats: DetailedUserStats; onStatClick?: StatsInsightsProps["onStatClick"] }) {
  const categories = [
    { label: "Bad", key: "bad" as const, count: stats.badCount, color: "#595959", text: "text-[#777]" },
    { label: "Average", key: "average" as const, count: stats.averageCount, color: "#918a7c", text: "text-[#a49d90]" },
    { label: "Good", key: "good" as const, count: stats.goodCount, color: "#f5f0de", text: "text-[#f5f0de]" },
    { label: "Masterpiece", key: "masterpiece" as const, count: stats.masterpieceCount, color: "#c45b2a", text: "text-[#c45b2a]" },
  ];
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  const segmentCount = 40;
  const segments = categories.map((item) => {
    const exact = total ? (item.count / total) * segmentCount : 0;
    const count = total ? Math.floor(exact) : 0;
    return { ...item, segments: count, percentage: total ? Math.round((item.count / total) * 100) : 0 };
  });

  // Distribute leftover segments by largest fractional remainder so the strip always fills evenly.
  if (total) {
    const remaining = segmentCount - segments.reduce((sum, item) => sum + item.segments, 0);
    const ranked = categories.map((item, index) => ({ index, remainder: ((item.count / total) * segmentCount) % 1 }))
      .sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; index < remaining; index += 1) segments[ranked[index % ranked.length].index].segments += 1;
  }

  const bars = total
    ? segments.flatMap((item) => Array.from({ length: item.segments }, (_, index) => <span key={`${item.key}-${index}`} className="h-10 rounded-[2px] sm:h-14" style={{ backgroundColor: item.color }} />))
    : Array.from({ length: segmentCount }, (_, index) => <span key={index} className="h-10 rounded-[2px] bg-[#f5f0de]/10 sm:h-14" />);

  return <div className="col-span-3 min-w-0 py-4 sm:py-6">
    <div className="grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }} role="img" aria-label={`Rating distribution across ${total} rated logs`}>
      {bars}
    </div>
    <div className="mt-4 grid grid-cols-4 gap-2 sm:mt-6 sm:gap-4">
      {segments.map((item) => <button key={item.key} type="button" onClick={onStatClick ? () => onStatClick(item.key) : undefined} className={`min-w-0 text-left ${onStatClick ? "focus-visible:outline-2 focus-visible:outline-[#c45b2a]" : "cursor-default"}`}>
        <span className={`block text-xl font-black tabular-nums sm:text-3xl ${item.text}`}>{item.percentage}%</span>
        <span className="mt-1 block truncate text-xs text-[#f5f0de]/55 sm:mt-2 sm:text-base">{item.label}</span>
      </button>)}
    </div>
  </div>;
}

function TopGenres({ items, onItemClick }: { items: StatDistributionItem[]; onItemClick?: (value: string) => void }) {
  const top = items.slice(0, 5);
  return <div className={`${CARD} ${SURFACE.orange} col-span-2 flex min-h-64 flex-col p-3 sm:min-h-72 sm:p-7`}>
    <h3 className="text-base font-black tracking-tight text-[#0e0d0b] sm:text-xl">Top genres</h3>
    {top.length ? <div className="mt-5 flex flex-1 items-center">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 sm:gap-8">
        <button type="button" onClick={onItemClick ? () => onItemClick(top[0].label) : undefined} className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#c45b2a]">
          <span className="block break-words text-xl font-black leading-tight text-[#0e0d0b] sm:text-3xl">{top[0].label}</span>
          <span className="mt-2 block text-3xl font-black leading-none tracking-normal text-[#0e0d0b] sm:text-5xl">{top[0].percentage}%</span>
        </button>
        <div className="space-y-2 sm:space-y-3">
          {top.slice(1).map((item) => <button key={item.label} type="button" onClick={onItemClick ? () => onItemClick(item.label) : undefined} className="flex w-full items-center justify-between gap-1 text-left focus-visible:outline-2 focus-visible:outline-[#c45b2a] sm:gap-3">
            <span className="min-w-0 break-words text-[10px] font-bold leading-tight text-[#0e0d0b]/85 sm:text-base">{item.label}</span>
            <span className="shrink-0 text-sm font-bold leading-none tracking-normal text-[#0e0d0b] sm:text-2xl">{item.percentage}%</span>
          </button>)}
        </div>
      </div>
    </div> : <p className="mt-8 text-sm text-[#0e0d0b]/55">Genres will appear as you log titles.</p>}
  </div>;
}

function SmallMetric({ label, value, tone }: { label: string; value: string | number; tone: StatsTone }) {
  const isLight = tone === "orange" || tone === "cream";
  return <div className={`${CARD} ${SURFACE[tone]} flex min-h-32 flex-col items-center justify-center p-3 text-center sm:p-5`}>
    <p className={`text-[9px] font-black uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.18em] ${isLight ? "text-[#0e0d0b]/60" : "text-[#f5f0de]/50"}`}>{label}</p>
    <p className={`mt-3 text-3xl font-black leading-none tracking-[0.08em] sm:text-5xl ${isLight ? "text-[#0e0d0b]" : "text-[#d46b35]"}`}>{value}</p>
  </div>;
}

function VerdictCard({ stats, onStatClick }: { stats: DetailedUserStats; onStatClick?: StatsInsightsProps["onStatClick"] }) {
  const overallVerdict = getReactionAverageLabel(stats);
  const verdicts = [
    { label: "Bad", count: stats.badCount, key: "bad" as const },
    { label: "Average", count: stats.averageCount, key: "average" as const },
    { label: "Good", count: stats.goodCount, key: "good" as const },
    { label: "Masterpiece", count: stats.masterpieceCount, key: "masterpiece" as const },
  ];
  return <div className={`${CARD} ${SURFACE.cream} col-span-2 flex min-h-44 flex-col p-4 text-[#0e0d0b] sm:p-6`}>
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0e0d0b]/55 sm:text-xs">Your verdict</p>
    <div className="mt-5 grid flex-1 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-8">
      <h3 className="text-4xl font-black leading-none text-[#0e0d0b] sm:text-6xl">{overallVerdict}</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-6 sm:gap-y-5">
        {verdicts.map((item) => <button key={item.key} type="button" onClick={onStatClick ? () => onStatClick(item.key) : undefined} className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#c45b2a]">
          <span className={`block text-2xl font-black leading-none tabular-nums sm:text-3xl ${item.label === overallVerdict ? "text-[#0e0d0b]" : "text-[#0e0d0b]/80"}`}>{item.count}</span>
          <span className="mt-1 block break-words text-[10px] font-bold uppercase leading-tight tracking-wide text-[#0e0d0b]/55 sm:text-xs">{item.label}</span>
        </button>)}
      </div>
    </div>
  </div>;
}

function MonthCard({ stats }: { stats: DetailedUserStats }) {
  return <div className={`${CARD} ${SURFACE.charcoal} flex min-h-44 flex-col items-center justify-center p-3 text-center sm:p-5`}>
    <h3 className={LABEL}>This month</h3>
    <div className="mt-5 grid w-full grid-cols-2 gap-2">
      <div><p className="text-3xl font-black leading-none text-[#d46b35] sm:text-4xl">{stats.movieCountThisMonth}</p><p className="mt-2 text-xs font-bold text-[#f5f0de]/50">Movies</p></div>
      <div><p className="text-3xl font-black leading-none text-[#d46b35] sm:text-4xl">{stats.tvCountThisMonth}</p><p className="mt-2 text-xs font-bold text-[#f5f0de]/50">TV shows</p></div>
    </div>
  </div>;
}

function TheatreRunRate({ stats }: { stats: DetailedUserStats }) {
  const percentage = stats.movieWatchCount > 0
    ? Math.round((stats.theatreWatchCount / stats.movieWatchCount) * 100)
    : null;

  return <div className={`${CARD} ${SURFACE.carbon} col-span-3 px-4 py-4 sm:px-6 sm:py-5`}>
    <div className="flex items-center justify-between gap-4">
      <div>
        <h3 className={LABEL}>Theatre run rate</h3>
        <p className="mt-1 text-xs text-[#f5f0de]/45 sm:text-sm">{stats.theatreWatchCount} of {stats.movieWatchCount} movie watches in theatre</p>
      </div>
      <span className="text-3xl font-black tabular-nums text-[#f5f0de] sm:text-4xl">{percentage === null ? "—" : `${percentage}%`}</span>
    </div>
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#f5f0de]/10" aria-hidden="true">
      <div className="h-full rounded-full bg-[#c45b2a]" style={{ width: `${percentage ?? 0}%` }} />
    </div>
  </div>;
}

function PeopleCard({ title, items, tone, onItemClick, onViewMore }: { title: string; items: StatDistributionItem[]; tone: StatsTone; onItemClick?: (value: string) => void; onViewMore: () => void }) {
  const top = items.slice(0, 3);
  const isCream = tone === "cream";
  return <div className={`${CARD} ${SURFACE[tone]} flex min-h-48 flex-col p-2 text-center sm:min-h-72 sm:p-6 lg:min-h-80`}>
    <h3 className={`text-[10px] font-black uppercase tracking-[0.22em] ${isCream ? "text-[#c45b2a]" : "text-[#d46b35]"}`}>{title}</h3>
    {top.length ? <div className="mt-4 grid grid-cols-3 sm:mt-6">
      {top.map((item) => <button key={item.label} type="button" onClick={onItemClick ? () => onItemClick(item.label) : undefined} className="flex min-w-0 flex-col items-center gap-1.5 px-0.5 focus-visible:outline-2 focus-visible:outline-[#c45b2a] sm:gap-2 sm:px-2">
        <span className="relative flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f5f0de]/10 bg-[#25211d] text-sm font-black text-[#d46b35] sm:w-16 sm:text-lg lg:w-20">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : item.label.slice(0, 1).toUpperCase()}
        </span>
        <span className={`flex min-h-8 min-w-0 items-center justify-center text-[9px] font-bold leading-tight sm:min-h-10 sm:text-sm sm:leading-snug ${isCream ? "text-[#0e0d0b]" : "text-[#f5f0de]"}`}><span className="line-clamp-2 break-words">{item.label}</span></span>
        <span className={`text-[11px] font-semibold tabular-nums ${isCream ? "text-[#c45b2a]" : "text-[#d46b35]"}`}>{item.count}</span>
      </button>)}
    </div> : <p className={`mt-5 text-sm ${isCream ? "text-[#0e0d0b]/50" : "text-[#f5f0de]/40"}`}>People will appear as you log titles.</p>}
    {items.length > 0 && <button type="button" onClick={onViewMore} className={`mt-auto self-center pt-4 text-xs font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-[#c45b2a] ${isCream ? "text-[#c45b2a]" : "text-[#d46b35]"}`}>View more</button>}
  </div>;
}

function PeopleRankingModal({ title, items, onClose, onItemClick }: { title: string; items: StatDistributionItem[]; onClose: () => void; onItemClick?: (value: string) => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" role="presentation">
    <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close ranking" />
    <div role="dialog" aria-modal="true" aria-label={`${title} ranking`} className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#f5f0de]/15 bg-[#1c1a17] text-[#f5f0de] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#f5f0de]/10 p-4 sm:p-5">
        <div><h3 className="text-lg font-bold">{title}</h3><p className="text-xs text-[#f5f0de]/45">Full ranking · {items.length} people</p></div>
        <button type="button" onClick={onClose} aria-label="Close ranking" className="rounded-full p-2 text-[#f5f0de]/60 hover:bg-[#f5f0de]/10 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="overflow-y-auto p-3 sm:p-4">
        {items.map((item, index) => <button key={item.label} type="button" onClick={onItemClick ? () => onItemClick(item.label) : undefined} className="flex w-full items-center gap-3 border-b border-[#f5f0de]/10 px-2 py-3 text-left last:border-0 hover:bg-[#f5f0de]/5 focus-visible:outline-2 focus-visible:outline-[#c45b2a]">
          <span className="w-7 shrink-0 text-sm font-bold text-[#d46b35]">{index + 1}</span>
          <span className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-[#f5f0de]/10 bg-[#25211d] text-sm font-bold text-[#d46b35]">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : item.label.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</span>
          <span className="shrink-0 text-sm text-[#f5f0de]/50">{item.count} {item.count === 1 ? "title" : "titles"}</span>
        </button>)}
      </div>
    </div>
  </div>;
}

function LanguagesCard({ items, onItemClick }: { items: StatDistributionItem[]; onItemClick?: (value: string) => void }) {
  return <div className={`${CARD} ${SURFACE.orange} p-4 sm:p-7`}>
    <h3 className="text-lg font-black text-[#0e0d0b] sm:text-2xl">Top languages</h3>
    {items.length ? <div className="mt-5 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:gap-5 sm:overflow-visible sm:pb-0">
      {items.slice(0, 5).map((item) => <button key={item.label} type="button" onClick={onItemClick ? () => onItemClick(item.label) : undefined} className="w-28 shrink-0 text-left focus-visible:outline-2 focus-visible:outline-[#c45b2a] sm:w-auto sm:min-w-0">
        <span className="block break-words text-base font-black leading-tight text-[#0e0d0b] sm:text-lg">{item.label}</span>
        <span className="mt-1 block text-xl font-bold text-[#c45b2a] sm:text-2xl">{item.count}</span>
      </button>)}
    </div> : <p className="mt-5 text-sm text-[#0e0d0b]/50">Languages will appear as you log titles.</p>}
  </div>;
}

export default function StatsInsights({ stats, onStatClick, onTasteClick, filterAction }: StatsInsightsProps) {
  const [openRanking, setOpenRanking] = useState<"director" | "actor" | null>(null);
  const watchTime = stats.runtimeCoverage
    ? `${formatWatchDuration(stats.estimatedWatchTimeMinutes)}${stats.runtimeCoverage < stats.watchedCount ? "+" : ""}`
    : "—";
  return <section className={`${styles.screenStory} mb-10 rounded-2xl bg-[#0e0d0b] px-3 py-4 sm:px-5 sm:py-6`} aria-labelledby="profile-stats-heading">
    <div className="mb-5 flex items-center justify-between gap-3"><h2 id="profile-stats-heading" className="text-xl font-black tracking-[-0.04em] text-[#f5f0de] sm:text-2xl">Your screen story</h2>{filterAction}</div>
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <MetricCard label="Total logs" value={stats.totalLogged} tone="carbon" onClick={onStatClick ? () => onStatClick("all") : undefined} />
      <MetricCard label="Movies" value={stats.movieCount} tone="charcoal" onClick={onStatClick ? () => onStatClick("movie") : undefined} />
      <MetricCard label="TV shows" value={stats.tvCount} tone="orange" onClick={onStatClick ? () => onStatClick("tv") : undefined} />
      <RatingDistribution stats={stats} onStatClick={onStatClick} />
      <TopGenres items={stats.genreDistribution} onItemClick={onTasteClick ? (value) => onTasteClick("genre", value) : undefined} />
      <div className="grid grid-rows-2 gap-2 sm:gap-4">
        <SmallMetric label="Total watch time" value={watchTime} tone="charcoal" />
        <SmallMetric label="Rewatches" value={stats.rewatchCount} tone="orange" />
      </div>
      <VerdictCard stats={stats} onStatClick={onStatClick} />
      <MonthCard stats={stats} />
      <TheatreRunRate stats={stats} />
      <div className="col-span-3 grid grid-cols-2 gap-2 sm:gap-4">
        <PeopleCard title="Top directors" items={stats.topDirectors} tone="charcoal" onItemClick={onTasteClick ? (value) => onTasteClick("director", value) : undefined} onViewMore={() => setOpenRanking("director")} />
        <PeopleCard title="Top actors" items={stats.topActors} tone="cream" onItemClick={onTasteClick ? (value) => onTasteClick("actor", value) : undefined} onViewMore={() => setOpenRanking("actor")} />
      </div>
      <div className="col-span-3"><LanguagesCard items={stats.languageDistribution} onItemClick={onTasteClick ? (value) => onTasteClick("language", value) : undefined} /></div>
    </div>
    {openRanking && <PeopleRankingModal title={openRanking === "actor" ? "Top actors" : "Top directors"} items={openRanking === "actor" ? stats.topActors : stats.topDirectors} onClose={() => setOpenRanking(null)} onItemClick={onTasteClick ? (value) => onTasteClick(openRanking, value) : undefined} />}
  </section>;
}
