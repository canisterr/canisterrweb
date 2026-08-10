"use client";

import { useEffect, useRef, useState } from "react";
import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS } from "@/lib/store/quality";
import type { StoreSectionAnchor } from "@/types/store";

/** Exit radius = enter radius + this margin. Without this gap, standing near the
 *  boundary causes shelves to mount/unmount every frame — visible poster flicker. */
const HYSTERESIS_MARGIN = 6;

/**
 * True while the player is close enough to `anchor` that its shelves should
 * be fetched/mounted. Uses a wider "stay active" radius than "become active"
 * radius (hysteresis) so hovering near the boundary doesn't thrash.
 */
export function useSectionActive(anchor: StoreSectionAnchor): boolean {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    function evaluate() {
      const state = useStoreScene.getState();
      const enterRadius = QUALITY_PRESETS[state.qualityTier].activeSectionRadius;
      const exitRadius = enterRadius + HYSTERESIS_MARGIN;
      const dx = state.playerPosition[0] - anchor.position[0];
      const dz = state.playerPosition[2] - anchor.position[2];
      const distanceSq = dx * dx + dz * dz;
      const threshold = activeRef.current ? exitRadius : enterRadius;
      const shouldBeActive = distanceSq <= threshold * threshold;

      if (shouldBeActive !== activeRef.current) {
        activeRef.current = shouldBeActive;
        setActive(shouldBeActive);
      }
    }

    evaluate();
    return useStoreScene.subscribe(evaluate);
  }, [anchor]);

  return active;
}
