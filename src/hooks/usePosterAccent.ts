"use client";

import { useEffect, useMemo, useState } from "react";
import { lsGet, lsSet } from "@/lib/local-cache";
import { getTmdbPosterUrl, resizeTmdbCdnUrl } from "@/lib/performance";

type PosterAccent = { background: string; foreground: string; border: string };
const POSTER_ACCENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function colorFromSeed(seed: string): PosterAccent {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const background = `hsl(${hue} 30% 23%)`;
  const foreground = "#f8f4ea";
  const border = `hsl(${hue} 35% 34%)`;
  return { background, foreground, border };
}

function accentFromImage(image: HTMLImageElement): PosterAccent | null {
  const canvas = document.createElement("canvas");
  canvas.width = 36;
  canvas.height = 54;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = Array.from({ length: 18 }, () => 0);

  for (let index = 0; index < pixels.length; index += 16) {
    if (pixels[index + 3] < 200) continue;
    const red = pixels[index] / 255;
    const green = pixels[index + 1] / 255;
    const blue = pixels[index + 2] / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const chroma = maximum - minimum;
    const saturation = maximum === 0 ? 0 : chroma / maximum;
    if (saturation < 0.25 || maximum < 0.12 || maximum > 0.92) continue;

    let hue = 0;
    if (maximum === red) hue = ((green - blue) / chroma) % 6;
    else if (maximum === green) hue = (blue - red) / chroma + 2;
    else hue = (red - green) / chroma + 4;
    hue = (hue * 60 + 360) % 360;
    buckets[Math.floor(hue / 20)] += saturation * (0.4 + maximum);
  }

  const strongest = Math.max(...buckets);
  if (strongest <= 0) return null;
  const hue = buckets.indexOf(strongest) * 20 + 10;
  return {
    background: `hsl(${hue} 30% 23%)`,
    foreground: "#f8f4ea",
    border: `hsl(${hue} 35% 34%)`,
  };
}

export function usePosterAccent(posterUrl: string | null | undefined, seed: string) {
  const fallback = useMemo(() => colorFromSeed(seed), [seed]);
  const [accent, setAccent] = useState<{ url: string; value: PosterAccent } | null>(null);

  useEffect(() => {
    if (!posterUrl) return;

    let cancelled = false;
    const cacheKey = `poster-accent-v2:${posterUrl}`;
    const cached = lsGet<PosterAccent>(cacheKey, POSTER_ACCENT_TTL_MS);
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) setAccent({ url: posterUrl, value: cached });
      });
      return () => { cancelled = true; };
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const sampled = accentFromImage(image) || fallback;
        lsSet(cacheKey, sampled, POSTER_ACCENT_TTL_MS);
        setAccent({ url: posterUrl, value: sampled });
      } catch {
        lsSet(cacheKey, fallback, POSTER_ACCENT_TTL_MS);
        setAccent({ url: posterUrl, value: fallback });
      }
    };
    image.onerror = () => {
      if (!cancelled) lsSet(cacheKey, fallback, POSTER_ACCENT_TTL_MS);
    };
    const source = getTmdbPosterUrl(posterUrl, "w92") || posterUrl;
    image.src = source.startsWith("https://image.tmdb.org/t/p/") ? resizeTmdbCdnUrl(source, "w92") : source;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [posterUrl, fallback]);

  return accent && accent.url === posterUrl ? accent.value : fallback;
}
