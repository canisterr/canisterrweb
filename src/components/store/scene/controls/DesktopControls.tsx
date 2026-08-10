"use client";

import { useEffect, type MutableRefObject } from "react";
import { usePointerLook } from "./usePointerLook";
import type { MovementInputState } from "./movement-input";

const FORWARD_KEYS = new Set(["KeyW", "ArrowUp"]);
const BACK_KEYS = new Set(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set(["KeyD", "ArrowRight"]);

/** WASD/arrow-key walking plus click-and-drag look. No pointer lock — this should never read as an FPS. */
export default function DesktopControls({ inputRef }: { inputRef: MutableRefObject<MovementInputState> }) {
  usePointerLook(inputRef);

  useEffect(() => {
    const pressed = new Set<string>();

    function recompute() {
      let forward = 0;
      let strafe = 0;
      pressed.forEach((code) => {
        if (FORWARD_KEYS.has(code)) forward += 1;
        if (BACK_KEYS.has(code)) forward -= 1;
        if (RIGHT_KEYS.has(code)) strafe += 1;
        if (LEFT_KEYS.has(code)) strafe -= 1;
      });
      inputRef.current.forward = Math.max(-1, Math.min(1, forward));
      inputRef.current.strafe = Math.max(-1, Math.min(1, strafe));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!FORWARD_KEYS.has(event.code) && !BACK_KEYS.has(event.code) && !LEFT_KEYS.has(event.code) && !RIGHT_KEYS.has(event.code)) {
        return;
      }
      // Avoid hijacking typing in search/inputs.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      pressed.add(event.code);
      recompute();
    }

    function onKeyUp(event: KeyboardEvent) {
      pressed.delete(event.code);
      recompute();
    }

    function onBlur() {
      pressed.clear();
      recompute();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const input = inputRef.current;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      input.forward = 0;
      input.strafe = 0;
    };
  }, [inputRef]);

  return null;
}
