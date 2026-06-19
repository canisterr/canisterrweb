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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-4 backdrop-blur-md">
      <div
        role="status"
        aria-live="polite"
        aria-label={description}
        className="flex h-40 w-40 flex-col items-center justify-center rounded-full border border-white/10 bg-[#111111]/95 p-5 text-center text-[#f5f0de] shadow-2xl shadow-black/40 ring-1 ring-[#ff7a1a]/15 backdrop-blur-xl sm:h-44 sm:w-44"
      >
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 text-[#ff9c4a] shadow-[0_0_24px_rgba(255,122,26,0.22)]">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
        </span>
        <span className="mt-3 max-w-[7.5rem]">
          <LoadingTypewriterText text={loadingTitle} className="block text-[13px] font-semibold leading-4" />
          <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">Loading</span>
        </span>
      </div>
    </div>
  );
}
