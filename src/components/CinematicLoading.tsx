"use client";

import { useState } from "react";
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
    <div className="relative flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-black px-4 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[#000000]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.16),_transparent_26%),radial-gradient(circle_at_80%_18%,_rgba(255,173,89,0.08),_transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.015)_0px,rgba(255,255,255,0.015)_1px,transparent_1px,transparent_24px)] opacity-40" />

      <div
        role="status"
        aria-live="polite"
        aria-label={message}
        className="relative z-10 flex w-full max-w-3xl flex-col items-center justify-center text-center"
      >
        <LoadingTypewriterText
          text={loadingTitle || message}
          className="block text-4xl font-black uppercase tracking-[0.22em] text-[#f5f0de] sm:text-6xl"
        />
        <p className="mt-4 text-sm uppercase tracking-[0.3em] text-white/42 sm:text-base">{message}</p>
      </div>
    </div>
  );
}
