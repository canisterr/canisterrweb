"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import LoadingTypewriterText from "@/components/LoadingTypewriterText";
import { takePendingLoadingTitle } from "@/lib/loading-title";

type RouteLoadingSkeletonProps = {
  title: string;
  description: string;
};

export default function RouteLoadingSkeleton({ title, description }: RouteLoadingSkeletonProps) {
  const [loadingTitle] = useState(() => takePendingLoadingTitle() || title);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black px-4">
      <div
        role="status"
        aria-live="polite"
        aria-label={description}
        className="w-full max-w-lg overflow-hidden border border-white/10 bg-[#050505] text-[#f5f0de] shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
      >
        <div className="border-b border-white/10 bg-[#101010] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff7a1a]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffb36b]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">Movie cassette</span>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5 sm:py-6">
          <div className="border border-white/10 bg-[#0b0b0b] p-3 sm:p-4">
            <div className="rounded-sm border border-[#ff7a1a]/18 bg-[#f1dfbf] px-4 py-3 text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-black/55">Now loading</span>
                  <LoadingTypewriterText text={loadingTitle} className="mt-2 block break-words font-mono text-sm leading-5 sm:text-base" />
                </div>
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-black/15 bg-black/5 text-[#a14f00]">
                  <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2.5} />
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div className="relative flex aspect-square items-center justify-center rounded-full border border-white/12 bg-[#151515]">
                <div className="absolute h-[72%] w-[72%] rounded-full border border-white/10 bg-[#0c0c0c]" />
                <div className="absolute h-[36%] w-[36%] rounded-full border border-[#ff7a1a]/25 bg-[#1b1b1b]" />
                <div className="absolute h-2 w-2 rounded-full bg-[#ffb36b]" />
              </div>
              <div className="flex h-8 w-14 items-center justify-center border-y border-white/10 bg-[#121212] text-[#ff9c4a]">
                <div className="h-2 w-2 rounded-full bg-current shadow-[0_0_12px_rgba(255,156,74,0.35)]" />
              </div>
              <div className="relative flex aspect-square items-center justify-center rounded-full border border-white/12 bg-[#151515]">
                <div className="absolute h-[72%] w-[72%] rounded-full border border-white/10 bg-[#0c0c0c]" />
                <div className="absolute h-[36%] w-[36%] rounded-full border border-[#ff7a1a]/25 bg-[#1b1b1b]" />
                <div className="absolute h-2 w-2 rounded-full bg-[#ffb36b]" />
              </div>
            </div>

            <span className="mt-4 block text-xs leading-5 text-white/55">{description}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
