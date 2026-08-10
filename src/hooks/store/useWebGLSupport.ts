"use client";

import { useEffect, useState } from "react";

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * null while still checking, then a stable true/false. Deliberately deferred
 * to an effect (not a lazy useState initializer) — canvas/context creation
 * must never run during SSR, and computing it eagerly on the client would
 * risk a hydration mismatch against the server-rendered "unknown" markup.
 */
export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only capability probe, not derivable during render/SSR
    setSupported(detectWebGL());
  }, []);

  return supported;
}
