"use client";

import CinematicLoading from "@/components/CinematicLoading";

/** Branded entrance loading beat — the rest of the store loads progressively behind it. */
export default function LoadingOverlay() {
  return <CinematicLoading message="Opening the Canisterr Store" />;
}
