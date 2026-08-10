"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { MovementInputState } from "./movement-input";

const LOOK_SENSITIVITY = 0.0035;

/**
 * Click/touch-and-drag look, unified via the Pointer Events API (covers
 * mouse-drag on desktop and swipe on mobile with one implementation).
 * Deliberately not pointer-lock — the camera only turns while actively
 * dragging, which is what keeps this from reading as an FPS.
 */
export function usePointerLook(inputRef: MutableRefObject<MovementInputState>) {
  const { gl } = useThree();
  const dragState = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragState.current = { active: true, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    }

    function onPointerMove(event: PointerEvent) {
      const state = dragState.current;
      if (!state.active || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      // Dragging/swiping right turns the view right (natural "grab and turn" feel).
      // Both are pure per-event deltas — PlayerRig accumulates + clamps + smooths them,
      // so a burst of touch events doesn't snap the camera instantly.
      inputRef.current.yawDelta += dx * LOOK_SENSITIVITY;
      inputRef.current.pitchDelta += dy * LOOK_SENSITIVITY;
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== dragState.current.pointerId) return;
      dragState.current.active = false;
    }

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl, inputRef]);
}
