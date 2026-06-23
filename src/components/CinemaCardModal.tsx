"use client";

import { X } from "lucide-react";

export type CinemaCardSummary = {
  topGenres: string[];
  topDirector: string | null;
  topActor: string | null;
  topLanguage: string | null;
  averageRuntimeMinutes: number | null;
  totalLoggedTitles: number;
  totalMovieLogs: number;
};

type CinemaCardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  summary: CinemaCardSummary | null;
  loading: boolean;
  error: string | null;
};

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "No runtime data yet";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (!hours) return `${mins}m average`;
  if (!mins) return `${hours}h average`;
  return `${hours}h ${mins}m average`;
}

function renderValue(value: string | null, emptyLabel = "Not enough data yet") {
  return value ? (
    <p className="text-base font-black text-[#f5f0de] sm:text-lg">{value}</p>
  ) : (
    <p className="text-sm font-medium text-[#f5f0de]/45">{emptyLabel}</p>
  );
}

export default function CinemaCardModal({
  isOpen,
  onClose,
  summary,
  loading,
  error,
}: CinemaCardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close cinema card"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cinema-card-title"
        className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c0c] text-[#f5f0de] shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.22),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)]" />
        <div className="relative p-5 text-center sm:p-7">
          <div className="flex items-start justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#f5f0de] transition hover:border-[#ff7a1a]/35 hover:bg-[#ff7a1a]/10"
              aria-label="Close cinema card"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="-mt-4 space-y-1">
            <h2 id="cinema-card-title" className="text-2xl font-black tracking-tight text-[#f5f0de] sm:text-3xl">
              Cinema card
            </h2>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-20 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
                <div className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
                <div className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
                <div className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.04]" />
              </div>
            </div>
          ) : error ? (
            <div className="mt-6 rounded-[1.5rem] border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
              {error}
            </div>
          ) : !summary || summary.totalLoggedTitles === 0 ? (
            <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-5 py-6">
              <p className="text-lg font-black text-[#f5f0de]">Nothing on the card yet</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Log a few movies or shows and this card will start surfacing your recurring genres, creators, and
                language patterns.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 space-y-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Genres</p>
                  <div className="mt-2">
                    {summary.topGenres.length > 0 ? (
                      <p className="text-base font-black text-[#f5f0de] sm:text-lg">{summary.topGenres.join(" • ")}</p>
                    ) : (
                      <p className="text-sm font-medium text-[#f5f0de]/45">Log a bit more to surface your top genres.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Director</p>
                  <div className="mt-2">{renderValue(summary.topDirector)}</div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Lead actor</p>
                  <div className="mt-2">{renderValue(summary.topActor)}</div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Language</p>
                  <div className="mt-2">{renderValue(summary.topLanguage)}</div>
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">Average movie runtime</p>
                  <p className="mt-2 text-base font-black text-[#f5f0de] sm:text-lg">
                    {formatRuntime(summary.averageRuntimeMinutes)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
