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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black px-4">
      <div
        role="status"
        aria-live="polite"
        aria-label={description}
        className="flex w-full max-w-3xl flex-col items-center justify-center text-center text-[#f5f0de]"
      >
        <LoadingTypewriterText text={loadingTitle} className="block text-3xl font-black uppercase tracking-[0.22em] text-[#f5f0de] sm:text-5xl" />
        <span className="mt-4 block text-xs uppercase tracking-[0.3em] text-white/42 sm:text-sm">{description}</span>
      </div>
    </div>
  );
}
