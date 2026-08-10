"use client";

import { Hand, Map as MapIcon, MousePointerClick, Move, Navigation, Search } from "lucide-react";
import { useEscapeKey } from "@/hooks/store/useEscapeKey";

interface ControlsHintProps {
  isTouchPrimary: boolean;
  onDismiss: () => void;
}

interface HintRow {
  icon: typeof Hand;
  title: string;
  description: string;
}

const DESKTOP_ROWS: HintRow[] = [
  { icon: Move, title: "Walk", description: "W A S D or the arrow keys" },
  { icon: MousePointerClick, title: "Look around", description: "Click and drag" },
  { icon: Hand, title: "Pick up a movie", description: "Click a poster to see details" },
];

const MOBILE_ROWS: HintRow[] = [
  { icon: Hand, title: "Look around", description: "Swipe anywhere" },
  { icon: Navigation, title: "Walk", description: "Tap the floor where you want to go" },
  { icon: MousePointerClick, title: "Pick up a movie", description: "Tap a poster to see details" },
];

/** First-visit (or reopened via the HUD "?" button) walkthrough of store controls. */
export default function ControlsHint({ isTouchPrimary, onDismiss }: ControlsHintProps) {
  useEscapeKey(onDismiss);
  const rows = isTouchPrimary ? MOBILE_ROWS : DESKTOP_ROWS;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Store controls"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.65)]"
      >
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#ff9a52]">Welcome to the Store</p>
        <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#f5f0de]">Getting Around</h2>

        <div className="mt-5 space-y-4">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.title} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#ffb36b]">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#f5f0de]">{row.title}</p>
                  <p className="text-sm text-[#f5f0de]/60">{row.description}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#ffb36b]">
              <MapIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#f5f0de]">Jump anywhere fast</p>
              <p className="text-sm text-[#f5f0de]/60">Use the map icon up top to teleport to any section</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#ffb36b]">
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#f5f0de]">Looking for something specific?</p>
              <p className="text-sm text-[#f5f0de]/60">Search by title, actor, or director up top</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
        >
          Got it — let&rsquo;s explore
        </button>
      </div>
    </div>
  );
}
