"use client";

import ReactionDistributionBar from "./ReactionDistributionBar";
import { getReactionAverageLabel, type DetailedUserStats, type StatDistributionItem } from "@/lib/profile";

interface StatsInsightsProps {
  stats: DetailedUserStats;
  onStatClick?: (type: "all" | "movie" | "tv" | "masterpiece" | "good" | "average" | "bad") => void;
  onTasteClick?: (type: "genre" | "actor" | "director" | "language", value: string) => void;
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";

  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${totalHours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">{title}</h3>
    </div>
  );
}

function MetricCell({
  label,
  value,
  accentClass,
  onClick,
}: {
  label: string;
  value: string | number;
  accentClass: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">{label}</p>
      <p className={`mt-3 text-3xl font-black tracking-tight ${accentClass}`}>{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group w-full text-left transition hover:-translate-y-0.5 hover:opacity-90">
        {content}
      </button>
    );
  }

  return <div className="w-full">{content}</div>;
}

function DistributionRow({ item }: { item: StatDistributionItem }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-white/75">{item.label}</span>
        <span className="shrink-0 text-sm font-semibold text-[#f5f0de]">
          {item.percentage}% <span className="text-white/35">({item.count})</span>
        </span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden bg-white/[0.07]">
        <div
          className="h-full bg-gradient-to-r from-[#ffd7ae] to-[#ff7a1a]"
          style={{ width: `${Math.max(item.percentage, 4)}%` }}
        />
      </div>
    </div>
  );
}

function DistributionColumn({ title, items }: { title: string; items: StatDistributionItem[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 border-b border-white/8 pb-2">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/35">{title}</h4>
      </div>
      <div>
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => <DistributionRow key={item.label} item={item} />)
        ) : (
          <p className="py-3 text-sm text-white/40">No data yet</p>
        )}
      </div>
    </div>
  );
}

function TasteTableCard({
  title,
  items,
  tone,
  onItemClick,
  showPortrait,
}: {
  title: string;
  items: StatDistributionItem[];
  tone: "orange" | "stone" | "sage" | "cream";
  onItemClick?: (value: string) => void;
  showPortrait?: boolean;
}) {
  const toneClass =
    tone === "orange"
      ? "border-[#ff7a1a]/40 bg-[#ff7a1a] text-black"
      : tone === "sage"
        ? "border-[#8f957e]/50 bg-[#91967d] text-black"
        : tone === "cream"
          ? "border-[#e9e4d6]/70 bg-[#ddd9cf] text-black"
          : "border-[#6b675f]/60 bg-[#5f5c57] text-[#f5f0de]";
  const mutedClass = tone === "stone" ? "text-white/65" : "text-black/60";
  const titleClass = tone === "stone" ? "text-white/45" : "text-black/55";

  return (
    <div className={`rounded-[1.85rem] border p-5 sm:p-6 ${toneClass}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${titleClass}`}>{title}</p>
      <div className="mt-5 space-y-3">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) =>
            onItemClick ? (
              <button
                key={item.label}
                type="button"
                onClick={() => onItemClick(item.label)}
                className={`flex w-full items-center justify-between gap-4 border-b ${tone === "stone" ? "border-white/10" : "border-black/10"} pb-3 text-left transition hover:-translate-y-0.5 last:border-b-0 last:pb-0`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {showPortrait ? (
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.label} className="h-9 w-7 shrink-0 rounded-[0.45rem] object-cover" />
                    ) : (
                      <span className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-[0.45rem] ${tone === "stone" ? "bg-white/10 text-white/70" : "bg-black/10 text-black/60"} text-[10px] font-semibold uppercase`}>
                        {item.label.charAt(0)}
                      </span>
                    )
                  ) : null}
                  <span className={`truncate text-sm uppercase tracking-[0.16em] ${mutedClass}`}>{item.label}</span>
                </span>
                <span className="w-14 shrink-0 text-right text-2xl font-black tracking-tight">{item.count}</span>
              </button>
            ) : (
              <div key={item.label} className={`flex items-center justify-between gap-4 border-b ${tone === "stone" ? "border-white/10" : "border-black/10"} pb-3 last:border-b-0 last:pb-0`}>
                <span className="flex min-w-0 items-center gap-3">
                  {showPortrait ? (
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.label} className="h-9 w-7 shrink-0 rounded-[0.45rem] object-cover" />
                    ) : (
                      <span className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-[0.45rem] ${tone === "stone" ? "bg-white/10 text-white/70" : "bg-black/10 text-black/60"} text-[10px] font-semibold uppercase`}>
                        {item.label.charAt(0)}
                      </span>
                    )
                  ) : null}
                  <span className={`truncate text-sm uppercase tracking-[0.16em] ${mutedClass}`}>{item.label}</span>
                </span>
                <span className="w-14 shrink-0 text-right text-2xl font-black tracking-tight">{item.count}</span>
              </div>
            )
          )
        ) : (
          <p className={`py-3 text-sm ${mutedClass}`}>No data yet</p>
        )}
      </div>
    </div>
  );
}

function DetailStrip({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ label: string; value: string | number }>;
  tone: "dark" | "warm";
}) {
  const toneClass = tone === "warm" ? "border-[#6f554a] bg-[#805a49] text-black" : "border-white/10 bg-[#101010] text-[#f5f0de]";

  return (
    <div className={`rounded-[1.85rem] border p-5 sm:p-6 ${toneClass}`}>
      <p className={`${tone === "warm" ? "text-black/60" : "text-white/35"} text-[11px] font-semibold uppercase tracking-[0.24em]`}>{title}</p>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.label} className={`flex items-center justify-between gap-4 border-b ${tone === "warm" ? "border-black/10" : "border-white/8"} pb-3 last:border-b-0 last:pb-0`}>
            <span className={`${tone === "warm" ? "text-black/75" : "text-white/60"} text-sm uppercase tracking-[0.18em]`}>{item.label}</span>
            <span className="text-2xl font-black tracking-tight">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackStatCard({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone: "orange" | "sage" | "charcoal" | "stone" | "cream";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "orange"
      ? "border-[#ff7a1a]/40 bg-[#ff7a1a] text-black"
      : tone === "sage"
        ? "border-[#8f957e]/50 bg-[#91967d] text-black"
        : tone === "cream"
          ? "border-[#e9e4d6]/70 bg-[#ddd9cf] text-black"
        : tone === "stone"
          ? "border-[#6b675f]/60 bg-[#5f5c57] text-[#f5f0de]"
          : "border-white/10 bg-[#111111] text-[#f5f0de]";

  const mutedClass = tone === "orange" || tone === "sage" || tone === "cream" ? "text-black/60" : "text-white/45";

  const content = (
    <div className={`flex h-full min-h-[180px] flex-col justify-between rounded-[1.85rem] border p-5 sm:p-6 ${toneClass}`}>
      <p className={`${mutedClass} text-[11px] font-semibold uppercase tracking-[0.22em]`}>{label}</p>
      <div className="mt-6">
        <p className="text-4xl font-black tracking-tight sm:text-5xl">{value}</p>
        {detail ? <p className={`${mutedClass} mt-3 text-sm leading-6`}>{detail}</p> : null}
      </div>
    </div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="h-full w-full text-left transition hover:-translate-y-0.5">
      {content}
    </button>
  );
}

function VerdictMiniCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "bad" | "average" | "good" | "masterpiece";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "bad"
      ? "border-rose-300/40 bg-rose-300 text-black"
      : tone === "average"
        ? "border-yellow-300/50 bg-yellow-300 text-black"
        : tone === "good"
          ? "border-green-300/40 bg-green-300 text-black"
          : "border-[#ff7a1a]/40 bg-[#ff7a1a] text-black";

  const content = (
    <div className={`rounded-[1.35rem] border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/60">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="w-full text-left transition hover:-translate-y-0.5">
      {content}
    </button>
  );
}

export default function StatsInsights({ stats, onStatClick, onTasteClick }: StatsInsightsProps) {
  const verdictRows: Array<{ label: string; value: number; key: "bad" | "average" | "good" | "masterpiece" }> = [
    { label: "Bad", value: stats.badCount, key: "bad" },
    { label: "Average", value: stats.averageCount, key: "average" },
    { label: "Good", value: stats.goodCount, key: "good" },
    { label: "Masterpiece", value: stats.masterpieceCount, key: "masterpiece" },
  ];

  return (
    <div className="mb-10 p-4 sm:p-6">
      <div className="border-b border-white/10 pb-5 text-center">
        <h2 className="text-2xl font-black tracking-[0.26em] text-[#f5f0de]">YOUR STATS</h2>
      </div>

      <section className="py-6">
        <SectionHeader title="Watching Snapshot" />

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <StackStatCard
                label="Total logged"
                value={stats.totalLogged}
                detail="Everything in your diary."
                tone="orange"
                onClick={onStatClick ? () => onStatClick("all") : undefined}
              />
              <StackStatCard
                label="Total watch time"
                value={formatDuration(stats.estimatedWatchTimeMinutes)}
                detail="Estimated from runtime data."
                tone="sage"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StackStatCard
                label="Movies logged"
                value={stats.movieCount}
                detail="Your film log count."
                tone="charcoal"
                onClick={onStatClick ? () => onStatClick("movie") : undefined}
              />
              <StackStatCard
                label="TV shows logged"
                value={stats.tvCount}
                detail="Series and shows tracked."
                tone="stone"
                onClick={onStatClick ? () => onStatClick("tv") : undefined}
              />
            </div>
            <DetailStrip
              title="Monthly Split"
              tone="warm"
              items={[
                { label: "Movies", value: stats.movieCountThisMonth },
                { label: "TV", value: stats.tvCountThisMonth },
              ]}
            />
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <StackStatCard
                label="Average verdict"
                value={getReactionAverageLabel(stats)}
                detail="Your overall verdict trend."
                tone="sage"
                onClick={onStatClick ? () => onStatClick("average") : undefined}
              />
              <StackStatCard
                label="Rewatches"
                value={stats.rewatchCount}
                detail="Titles you came back to."
                tone="cream"
              />
            </div>
            <div className="rounded-[1.85rem] border border-[#7f786d]/50 bg-[#8a7f6a] p-5 text-black sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/55">Verdict Breakdown</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {verdictRows.map((item) => (
                  <VerdictMiniCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    tone={item.key}
                    onClick={onStatClick ? () => onStatClick(item.key) : undefined}
                  />
                ))}
              </div>
              <div className="mt-6 border-t border-black/10 pt-4">
                <ReactionDistributionBar
                  badCount={stats.badCount}
                  averageCount={stats.averageCount}
                  goodCount={stats.goodCount}
                  masterpieceCount={stats.masterpieceCount}
                  showLabels={true}
                  theme="light"
                  onSegmentClick={onStatClick}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-6">
        <SectionHeader title="Taste Breakdown" />

        <div className="grid gap-4 lg:grid-cols-2">
          <TasteTableCard
            title="Genre Distribution"
            items={stats.genreDistribution}
            tone="orange"
            onItemClick={onTasteClick ? (value) => onTasteClick("genre", value) : undefined}
          />
          <TasteTableCard
            title="Top Actors"
            items={stats.topActors}
            tone="stone"
            onItemClick={onTasteClick ? (value) => onTasteClick("actor", value) : undefined}
            showPortrait={true}
          />
          <TasteTableCard
            title="Top Directors"
            items={stats.topDirectors}
            tone="sage"
            onItemClick={onTasteClick ? (value) => onTasteClick("director", value) : undefined}
            showPortrait={true}
          />
          <TasteTableCard
            title="Language"
            items={stats.languageDistribution}
            tone="cream"
            onItemClick={onTasteClick ? (value) => onTasteClick("language", value) : undefined}
          />
        </div>
      </section>
    </div>
  );
}
