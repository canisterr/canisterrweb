"use client";

import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS } from "@/lib/store/quality";
import type { StoreSectionAnchor } from "@/types/store";

/**
 * True while the player is close enough to `anchor` that its shelves should
 * be fetched/mounted. Backed by a zustand selector so a section only
 * re-renders when its own near/far state actually flips, not on every
 * player-position update. Radius scales with the active quality tier.
 */
export function useSectionActive(anchor: StoreSectionAnchor): boolean {
  return useStoreScene((state) => {
    const radius = QUALITY_PRESETS[state.qualityTier].activeSectionRadius;
    const dx = state.playerPosition[0] - anchor.position[0];
    const dz = state.playerPosition[2] - anchor.position[2];
    return dx * dx + dz * dz <= radius * radius;
  });
}
