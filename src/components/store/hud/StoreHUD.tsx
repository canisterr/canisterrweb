"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, HelpCircle, LayoutGrid, Map as MapIcon, RefreshCw, Search } from "lucide-react";
import { useStoreScene } from "@/lib/store/store-state";
import { trackStoreEvent } from "@/lib/store/analytics";

interface StoreHUDProps {
  onOpenSimpleView: () => void;
  onOpenControlsHint: () => void;
}

/** Minimal always-visible chrome: exit, search, map, refresh, controls help, simple-view toggle. */
export default function StoreHUD({ onOpenSimpleView, onOpenControlsHint }: StoreHUDProps) {
  const openMap = useStoreScene((s) => s.openMap);
  const openSearch = useStoreScene((s) => s.openSearch);
  const refreshShelves = useStoreScene((s) => s.refreshShelves);
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    refreshShelves();
    trackStoreEvent("store_shelves_refreshed");
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3 sm:p-4">
      <Link
        href="/dashboard"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 py-2.5 text-sm font-semibold text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50"
        aria-label="Exit the store, back to Canisterr"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Canisterr</span>
      </Link>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50 active:scale-95"
          aria-label="Search the store"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openMap}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50 active:scale-95"
          aria-label="Open store map"
        >
          <MapIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50 active:scale-95"
          aria-label="Refresh shelves to see other movies"
          title="Refresh shelves"
        >
          <RefreshCw className={`h-[18px] w-[18px] ${spinning ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenControlsHint}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50 active:scale-95"
          aria-label="Show controls"
          title="Controls"
        >
          <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenSimpleView}
          className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 text-sm font-semibold text-[#f5f0de] backdrop-blur-xl transition hover:border-[#ff7a1a]/50 active:scale-95"
          aria-label="Switch to simple, non-3D view"
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Simple View</span>
        </button>
      </div>
    </div>
  );
}
