"use client";

import { useMemo } from "react";
import { getStoreBounds } from "@/lib/store/layout";
import { useRegisterCollider } from "./collision-registry";

const CEILING_HEIGHT = 6.4;
const WALL_THICKNESS = 0.4;
const SLAB_THICKNESS = 0.3;

/** Floor, walls, ceiling and the outer boundary colliders. Deliberately plain — the shelves carry the visual interest. */
export default function StoreEnvironment() {
  const bounds = useMemo(() => getStoreBounds(), []);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.maxX + bounds.minX) / 2;
  const centerZ = (bounds.maxZ + bounds.minZ) / 2;

  useRegisterCollider(
    useMemo(
      () => ({ id: "wall-north", minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ - WALL_THICKNESS, maxZ: bounds.minZ }),
      [bounds]
    )
  );
  // No south-wall collider — bounds.maxZ is the open entrance.
  useRegisterCollider(
    useMemo(
      () => ({ id: "wall-west", minX: bounds.minX - WALL_THICKNESS, maxX: bounds.minX, minZ: bounds.minZ, maxZ: bounds.maxZ }),
      [bounds]
    )
  );
  useRegisterCollider(
    useMemo(
      () => ({ id: "wall-east", minX: bounds.maxX, maxX: bounds.maxX + WALL_THICKNESS, minZ: bounds.minZ, maxZ: bounds.maxZ }),
      [bounds]
    )
  );

  return (
    <group>
      {/* Floor/ceiling are thin boxes rather than rotated planes — flat rotated planes render unreliably under some software/WebGL rasterizers. */}
      <mesh position={[centerX, -SLAB_THICKNESS / 2, centerZ]}>
        <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
        <meshStandardMaterial color="#4a3c2c" roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh position={[centerX, CEILING_HEIGHT + SLAB_THICKNESS / 2, centerZ]}>
        <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
        <meshStandardMaterial color="#1c1611" roughness={1} />
      </mesh>

      <mesh position={[centerX, CEILING_HEIGHT / 2, bounds.minZ]}>
        <boxGeometry args={[width, CEILING_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#4d3f2e" roughness={0.9} />
      </mesh>
      <mesh position={[bounds.minX, CEILING_HEIGHT / 2, centerZ]}>
        <boxGeometry args={[WALL_THICKNESS, CEILING_HEIGHT, depth]} />
        <meshStandardMaterial color="#4d3f2e" roughness={0.9} />
      </mesh>
      <mesh position={[bounds.maxX, CEILING_HEIGHT / 2, centerZ]}>
        <boxGeometry args={[WALL_THICKNESS, CEILING_HEIGHT, depth]} />
        <meshStandardMaterial color="#4d3f2e" roughness={0.9} />
      </mesh>
    </group>
  );
}
