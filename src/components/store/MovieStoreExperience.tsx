"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import MovieStoreScene from "./scene/MovieStoreScene";
import StoreHUD from "./hud/StoreHUD";
import StoreMap from "./hud/StoreMap";
import StoreSearch from "./hud/StoreSearch";
import MoviePreview from "./hud/MoviePreview";
import SimpleStoreView from "./hud/SimpleStoreView";
import LoadingOverlay from "./hud/LoadingOverlay";
import ControlsHint from "./hud/ControlsHint";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { useWebGLSupport } from "@/hooks/store/useWebGLSupport";
import { useReducedMotion } from "@/hooks/store/useReducedMotion";
import { useStoreScene } from "@/lib/store/store-state";
import { getSectionAnchor, getSectionStandPoint } from "@/lib/store/layout";
import { trackStoreEvent } from "@/lib/store/analytics";
import type { User } from "@/types";

const VIEW_MODE_STORAGE_KEY = "canisterr_store_view_mode";
const CONTROLS_HINT_STORAGE_KEY = "canisterr_store_seen_controls";

interface MovieStoreExperienceProps {
  user: User | null;
  initialSectionId?: string | null;
  initialMovieId?: number | null;
}

export default function MovieStoreExperience({ user, initialSectionId, initialMovieId }: MovieStoreExperienceProps) {
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const viewMode = useStoreScene((s) => s.viewMode);
  const setViewMode = useStoreScene((s) => s.setViewMode);
  const selectMovie = useStoreScene((s) => s.selectMovie);
  const requestTeleport = useStoreScene((s) => s.requestTeleport);

  const [isTouchPrimary, setIsTouchPrimary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(false);

  useEffect(() => {
    setIsTouchPrimary(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    trackStoreEvent("store_opened");
  }, []);

  // One-time setup: restore/choose view mode and jump to any deep-linked section/movie.
  useEffect(() => {
    let mode: "3d" | "simple" = "3d";
    try {
      if (window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "simple") mode = "simple";
    } catch {
      // localStorage unavailable (private mode etc.) — default to 3d.
    }
    if (reducedMotion) mode = "simple";
    setViewMode(mode);

    try {
      if (window.localStorage.getItem(CONTROLS_HINT_STORAGE_KEY) !== "true" && mode === "3d") {
        setShowControlsHint(true);
      }
    } catch {
      setShowControlsHint(mode === "3d");
    }

    if (initialSectionId) {
      const anchor = getSectionAnchor(initialSectionId);
      if (anchor) requestTeleport(getSectionStandPoint(anchor), initialSectionId, true);
    }
    if (initialMovieId) selectMovie(initialMovieId);

    setInitialized(true);
    // Deliberately one-time: this initializes from URL/localStorage, it shouldn't re-run on every reducedMotion flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized) return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore — persistence is a nicety, not a requirement.
    }
  }, [viewMode, initialized]);

  if (webglSupported === null || !initialized) {
    return <LoadingOverlay />;
  }

  const effectiveMode = webglSupported ? viewMode : "simple";

  const dismissControlsHint = () => {
    setShowControlsHint(false);
    try {
      window.localStorage.setItem(CONTROLS_HINT_STORAGE_KEY, "true");
    } catch {
      // Ignore — persistence is a nicety, not a requirement.
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050403]">
      {effectiveMode === "simple" ? (
        <SimpleStoreView
          user={user}
          onSelectMovie={selectMovie}
          onSwitchTo3D={webglSupported ? () => setViewMode("3d") : undefined}
        />
      ) : (
        <SceneErrorBoundary onError={() => setViewMode("simple")}>
          <Suspense fallback={<LoadingOverlay />}>
            <Canvas
              shadows
              flat
              dpr={1}
              camera={{ fov: 68, near: 0.1, far: 120, position: [0, 1.65, 12] }}
              gl={{ antialias: true, powerPreference: "high-performance" }}
            >
              <MovieStoreScene userId={user?.id ?? null} isTouchPrimary={isTouchPrimary} />
            </Canvas>
          </Suspense>
          <StoreHUD onOpenSimpleView={() => setViewMode("simple")} onOpenControlsHint={() => setShowControlsHint(true)} />
        </SceneErrorBoundary>
      )}

      <StoreMap userSignedIn={Boolean(user)} />
      <StoreSearch />
      <MoviePreview user={user} />
      {showControlsHint && effectiveMode === "3d" && (
        <ControlsHint isTouchPrimary={isTouchPrimary} onDismiss={dismissControlsHint} />
      )}
    </div>
  );
}
