"use client";

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
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4 sm:bottom-6">
      <div
        role="status"
        aria-live="polite"
        aria-label={description}
        className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-white/10 bg-black/78 px-4 py-3 text-left text-[#f5f0de] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff7a1a] shadow-[0_0_18px_rgba(255,122,26,0.8)]" />
        <div className="min-w-0">
          <LoadingTypewriterText
            text={loadingTitle}
            className="block truncate text-sm font-black uppercase tracking-[0.22em] text-[#f5f0de] sm:text-base"
          />
          <span className="mt-1 block text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">{description}</span>
        </div>
      </div>
    </div>
  );
}
