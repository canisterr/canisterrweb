import type { QualityTier } from "@/types/store";

export interface QualitySettings {
  dpr: number;
  enableShadows: boolean;
  /** How far the player can be from a section's anchor before its shelves mount/fetch. */
  activeSectionRadius: number;
  nearPosterSize: "w185" | "w342" | "w500";
  farPosterSize: "w92" | "w185";
  maxShelfItems: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  performance: {
    dpr: 1,
    enableShadows: false,
    activeSectionRadius: 15,
    nearPosterSize: "w185",
    farPosterSize: "w92",
    maxShelfItems: 12,
  },
  balanced: {
    dpr: 1.5,
    enableShadows: false,
    activeSectionRadius: 22,
    nearPosterSize: "w342",
    farPosterSize: "w92",
    maxShelfItems: 18,
  },
  high: {
    dpr: 2,
    enableShadows: true,
    activeSectionRadius: 28,
    nearPosterSize: "w500",
    farPosterSize: "w185",
    maxShelfItems: 24,
  },
};

const QUALITY_ORDER: QualityTier[] = ["performance", "balanced", "high"];

export function downgradeTier(tier: QualityTier): QualityTier {
  const index = QUALITY_ORDER.indexOf(tier);
  return QUALITY_ORDER[Math.max(0, index - 1)];
}

/** One-time heuristic device read — cheap and dependency-free, no GPU-tier sniffing library. */
export function detectInitialQualityTier(): QualityTier {
  if (typeof navigator === "undefined") return "balanced";

  const isTouch = navigator.maxTouchPoints > 0 || /Mobi|Android/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  if (isTouch && (memory !== undefined ? memory <= 4 : cores <= 4)) return "performance";
  if (!isTouch && cores >= 8 && (memory === undefined || memory >= 8)) return "high";
  return "balanced";
}
