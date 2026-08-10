"use client";

import { useEffect, useState } from "react";
import type * as THREE from "three";
import { acquireTexture, releaseTexture } from "./texture-cache";

export type PosterTextureStatus = "idle" | "loading" | "loaded" | "error";

interface PosterTextureResult {
  texture: THREE.Texture | null;
  status: PosterTextureStatus;
}

interface LoadedState {
  url: string;
  texture: THREE.Texture | null;
  status: "loaded" | "error";
}

/**
 * Loads (and shares/caches) a poster texture without Suspense, so one
 * broken/missing TMDB image degrades to a placeholder instead of taking
 * down the whole shelf. "loading"/"idle" are derived during render from
 * whether `url` matches the last resolved load — only the actual async
 * resolution calls setState.
 */
export function usePosterTexture(url: string | null): PosterTextureResult {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    acquireTexture(url)
      .then((texture) => {
        if (!cancelled) setLoaded({ url, texture, status: "loaded" });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ url, texture: null, status: "error" });
      });

    return () => {
      cancelled = true;
      releaseTexture(url);
    };
  }, [url]);

  if (!url) {
    return { texture: null, status: "idle" };
  }
  if (loaded && loaded.url === url) {
    return { texture: loaded.texture, status: loaded.status };
  }
  return { texture: null, status: "loading" };
}
