"use client";

import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS } from "@/lib/store/quality";

/** A handful of lights total — mood variation between sections comes from backer-wall color, not extra lights. */
export default function Lighting() {
  const enableShadows = useStoreScene((s) => QUALITY_PRESETS[s.qualityTier].enableShadows);

  return (
    <>
      <hemisphereLight color="#948a76" groundColor="#2a241c" intensity={1.8} />
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[10, 16, 8]}
        intensity={2}
        color="#fff2e0"
        castShadow={enableShadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
      />
      <pointLight position={[0, 5, 9]} intensity={2} color="#ff9a52" distance={35} decay={1.6} />
    </>
  );
}
