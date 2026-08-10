import { create } from "zustand";
import type { QualityTier, StoreViewMode } from "@/types/store";

export interface TeleportRequest {
  position: [number, number, number];
  /** Skip the eased camera travel and snap instantly (prefers-reduced-motion). */
  immediate: boolean;
  targetSectionId: string | null;
}

interface StoreSceneState {
  qualityTier: QualityTier;
  viewMode: StoreViewMode;
  selectedMovieId: number | null;
  activeSectionId: string | null;
  playerPosition: [number, number, number];
  isMapOpen: boolean;
  isSearchOpen: boolean;
  webglSupported: boolean | null; // null = not checked yet
  teleportRequest: TeleportRequest | null;

  setQualityTier: (tier: QualityTier) => void;
  setViewMode: (mode: StoreViewMode) => void;
  selectMovie: (movieId: number | null) => void;
  setActiveSection: (sectionId: string | null) => void;
  setPlayerPosition: (position: [number, number, number]) => void;
  openMap: () => void;
  closeMap: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setWebglSupported: (supported: boolean) => void;
  requestTeleport: (position: [number, number, number], sectionId: string | null, immediate: boolean) => void;
  clearTeleport: () => void;
}

export const useStoreScene = create<StoreSceneState>((set) => ({
  qualityTier: "balanced",
  viewMode: "3d",
  selectedMovieId: null,
  activeSectionId: null,
  playerPosition: [0, 0, 0],
  isMapOpen: false,
  isSearchOpen: false,
  webglSupported: null,
  teleportRequest: null,

  setQualityTier: (tier) => set({ qualityTier: tier }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectMovie: (movieId) => set({ selectedMovieId: movieId }),
  setActiveSection: (sectionId) => set({ activeSectionId: sectionId }),
  setPlayerPosition: (position) => set({ playerPosition: position }),
  openMap: () => set({ isMapOpen: true, isSearchOpen: false }),
  closeMap: () => set({ isMapOpen: false }),
  openSearch: () => set({ isSearchOpen: true, isMapOpen: false }),
  closeSearch: () => set({ isSearchOpen: false }),
  setWebglSupported: (supported) => set({ webglSupported: supported }),
  requestTeleport: (position, sectionId, immediate) =>
    set({ teleportRequest: { position, targetSectionId: sectionId, immediate }, isMapOpen: false, isSearchOpen: false }),
  clearTeleport: () => set({ teleportRequest: null }),
}));

/** True whenever a DOM overlay is capturing input — movement should pause. */
export function useStoreControlsPaused(): boolean {
  return useStoreScene((state) => state.selectedMovieId !== null || state.isMapOpen || state.isSearchOpen);
}
