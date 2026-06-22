"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import LoadingTypewriterText from "@/components/LoadingTypewriterText";
import { takePendingLoadingTitle } from "@/lib/loading-title";

type CinematicLoadingProps = {
  message?: string;
  title?: string;
};

export default function CinematicLoading({
  message = "Your page is loading",
  title,
}: CinematicLoadingProps) {
  const [loadingTitle] = useState(() => title || takePendingLoadingTitle() || "");

  return (
    <div className="relative flex min-h-dvh w-screen items-center justify-center overflow-hidden px-4 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[#000000]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.16),_transparent_26%),radial-gradient(circle_at_80%_18%,_rgba(255,173,89,0.08),_transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.015)_0px,rgba(255,255,255,0.015)_1px,transparent_1px,transparent_24px)] opacity-40" />

      <div className="relative z-10 w-full max-w-2xl">
        <div
          role="status"
          aria-live="polite"
          aria-label={message}
          className="overflow-hidden border border-white/10 bg-[#050505] shadow-[0_32px_100px_rgba(0,0,0,0.65)]"
        >
          <div className="border-b border-white/10 bg-[#101010] px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff7a1a]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffb36b]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">Movie cassette</p>
            </div>
          </div>

          <div className="relative px-4 py-5 sm:px-6 sm:py-6">
            <div className="border border-white/10 bg-[#0b0b0b] p-3 sm:p-4">
              <div className="rounded-sm border border-[#ff7a1a]/18 bg-[#f1dfbf] px-4 py-3 text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-black/55">Canisterr loading</p>
                    <LoadingTypewriterText
                      text={loadingTitle || message}
                      className="mt-2 block break-words font-mono text-base leading-6 text-black sm:text-xl"
                    />
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-black/15 bg-black/5 text-[#a14f00]">
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
                <div className="relative flex aspect-square items-center justify-center rounded-full border border-white/12 bg-[#151515]">
                  <div className="absolute h-[72%] w-[72%] rounded-full border border-white/10 bg-[#0c0c0c]" />
                  <div className="absolute h-[36%] w-[36%] rounded-full border border-[#ff7a1a]/25 bg-[#1b1b1b]" />
                  <div className="absolute h-2.5 w-2.5 rounded-full bg-[#ffb36b]" />
                </div>

                <div className="flex h-10 w-16 items-center justify-center border-y border-white/10 bg-[#121212] text-[#ff9c4a] sm:h-12 sm:w-20">
                  <div className="h-2 w-2 rounded-full bg-current shadow-[0_0_12px_rgba(255,156,74,0.35)]" />
                </div>

                <div className="relative flex aspect-square items-center justify-center rounded-full border border-white/12 bg-[#151515]">
                  <div className="absolute h-[72%] w-[72%] rounded-full border border-white/10 bg-[#0c0c0c]" />
                  <div className="absolute h-[36%] w-[36%] rounded-full border border-[#ff7a1a]/25 bg-[#1b1b1b]" />
                  <div className="absolute h-2.5 w-2.5 rounded-full bg-[#ffb36b]" />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden bg-white/8">
                  <div className="cinematic-loading-bar h-full w-1/2 bg-gradient-to-r from-[#ff7a1a] via-[#ff9c4a] to-[#ffd08a]" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">Spooling</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/62">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
