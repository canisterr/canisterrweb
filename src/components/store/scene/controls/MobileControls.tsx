"use client";

import type { MutableRefObject } from "react";
import { usePointerLook } from "./usePointerLook";
import type { MovementInputState } from "./movement-input";

/** Swipe to look; tap-to-move/tap-to-inspect are handled by NavigationFloor and MovieCase respectively. */
export default function MobileControls({ inputRef }: { inputRef: MutableRefObject<MovementInputState> }) {
  usePointerLook(inputRef);
  return null;
}
