"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera, type Camera } from "three";

const BASE_VERTICAL_FOV = 68;
const TARGET_HORIZONTAL_FOV = 80;
const MAX_VERTICAL_FOV = 100;

/** Landscape/desktop keeps the original 68° vertical FOV untouched; portrait/narrow
 *  screens get a wider vertical FOV so the horizontal field of view doesn't collapse
 *  (a fixed vertical FOV alone makes mobile portrait feel badly zoomed in). */
function computeVerticalFov(aspect: number): number {
  if (aspect >= 1) return BASE_VERTICAL_FOV;
  const targetHalfHRad = MathUtils.degToRad(TARGET_HORIZONTAL_FOV / 2);
  const halfVRad = Math.atan(Math.tan(targetHalfHRad) / aspect);
  const vDeg = MathUtils.radToDeg(halfVRad) * 2;
  return MathUtils.clamp(Math.max(vDeg, BASE_VERTICAL_FOV), BASE_VERTICAL_FOV, MAX_VERTICAL_FOV);
}

export default function ResponsiveCamera() {
  const cameraRef = useRef<Camera | null>(null);
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam || !(cam instanceof PerspectiveCamera) || width === 0 || height === 0) return;
    const fov = computeVerticalFov(width / height);
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }, [width, height]);

  return null;
}
