"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { getStoreBounds } from "@/lib/store/layout";
import type { MovementInputState } from "./movement-input";

const TAP_MAX_DISTANCE_PX = 10;
const TAP_MAX_DURATION_MS = 350;

/**
 * Invisible plane covering the whole store floor. Handles "tap/click floor
 * to move" for both desktop and mobile (see usePointerLook for look input).
 * Sits a hair above the visual floor so it always wins the raycast there,
 * and movie cases stop propagation so tapping a poster never also walks you
 * toward it.
 */
export default function NavigationFloor({ inputRef }: { inputRef: MutableRefObject<MovementInputState> }) {
  const bounds = useMemo(() => getStoreBounds(), []);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;

  const tapState = useRef({ startX: 0, startY: 0, startTime: 0 });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    tapState.current = {
      startX: event.nativeEvent.clientX,
      startY: event.nativeEvent.clientY,
      startTime: performance.now(),
    };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const { startX, startY, startTime } = tapState.current;
    const dx = event.nativeEvent.clientX - startX;
    const dy = event.nativeEvent.clientY - startY;
    const elapsed = performance.now() - startTime;
    const wasTap = Math.hypot(dx, dy) < TAP_MAX_DISTANCE_PX && elapsed < TAP_MAX_DURATION_MS;
    if (wasTap) {
      inputRef.current.moveTarget = [event.point.x, event.point.z];
    }
  };

  return (
    <mesh position={[centerX, 0.005, centerZ]} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <boxGeometry args={[width, 0.01, depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
