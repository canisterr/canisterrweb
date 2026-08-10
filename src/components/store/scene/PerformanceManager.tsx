"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS, detectInitialQualityTier, downgradeTier } from "@/lib/store/quality";

const SAMPLE_WINDOW_MS = 3000;
const LOW_FPS_THRESHOLD = 40;
const MIN_TIME_BEFORE_DOWNGRADE_MS = 6000;

/**
 * Picks an initial quality tier from device heuristics, applies its DPR,
 * and runs a rolling FPS watchdog that downgrades one tier (never upgrades
 * mid-session, to avoid thrashing) if performance is sustained-poor.
 */
export default function PerformanceManager() {
  const { gl } = useThree();
  const qualityTier = useStoreScene((s) => s.qualityTier);
  const setQualityTier = useStoreScene((s) => s.setQualityTier);

  const frameCount = useRef(0);
  const windowStart = useRef(0);
  const lastDowngradeAt = useRef(0);

  useEffect(() => {
    setQualityTier(detectInitialQualityTier());
    const now = performance.now();
    windowStart.current = now;
    lastDowngradeAt.current = now;
  }, [setQualityTier]);

  useEffect(() => {
    const dpr = QUALITY_PRESETS[qualityTier].dpr;
    const deviceDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    gl.setPixelRatio(Math.min(dpr, deviceDpr));
  }, [gl, qualityTier]);

  useFrame(() => {
    frameCount.current += 1;
    const now = performance.now();
    const elapsed = now - windowStart.current;

    if (elapsed >= SAMPLE_WINDOW_MS) {
      const fps = (frameCount.current / elapsed) * 1000;
      frameCount.current = 0;
      windowStart.current = now;

      if (
        fps < LOW_FPS_THRESHOLD &&
        qualityTier !== "performance" &&
        now - lastDowngradeAt.current > MIN_TIME_BEFORE_DOWNGRADE_MS
      ) {
        lastDowngradeAt.current = now;
        setQualityTier(downgradeTier(qualityTier));
      }
    }
  });

  return null;
}
