"use client";

import { X, Compass } from "lucide-react";
import { useStoreScene } from "@/lib/store/store-state";
import { useEscapeKey } from "@/hooks/store/useEscapeKey";
import { GENRE_SECTIONS, COLLECTION_SECTIONS } from "@/lib/store/shelf-config";
import { PERSONALIZED_SECTIONS } from "@/lib/store/personalized-config";
import { getSectionAnchor, getSectionStandPoint } from "@/lib/store/layout";
import { trackStoreEvent } from "@/lib/store/analytics";
import type { PersonalizedSectionConfig, StoreSectionConfig } from "@/types/store";

interface MapGroup {
  title: string;
  items: (StoreSectionConfig | PersonalizedSectionConfig)[];
}

const GROUPS: MapGroup[] = [
  { title: "Canisterr", items: PERSONALIZED_SECTIONS },
  { title: "Collections", items: COLLECTION_SECTIONS },
  { title: "Genres", items: GENRE_SECTIONS },
];

export default function StoreMap({ userSignedIn }: { userSignedIn: boolean }) {
  const isOpen = useStoreScene((s) => s.isMapOpen);
  const closeMap = useStoreScene((s) => s.closeMap);
  const requestTeleport = useStoreScene((s) => s.requestTeleport);

  useEscapeKey(closeMap, isOpen);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    const anchor = getSectionAnchor(id);
    if (!anchor) return;
    requestTeleport(getSectionStandPoint(anchor), id, false);
    trackStoreEvent("store_map_used", { section_id: id });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Store map"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0c0c0c] shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[#f5f0de]">
            <Compass className="h-5 w-5 text-[#ff9a52]" aria-hidden="true" />
            <h2 className="text-lg font-black tracking-tight">Store Map</h2>
          </div>
          <button
            type="button"
            onClick={closeMap}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#f5f0de]/70 transition hover:border-[#ff7a1a]/50 hover:text-[#f5f0de]"
            aria-label="Close map"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <h3 className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#ff9a52]">{group.title}</h3>
              {group.title === "Canisterr" && !userSignedIn ? (
                <p className="text-sm text-[#f5f0de]/55">Sign in to unlock your personalized area.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50 hover:bg-white/[0.06]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
