import type { AabbCollider, StoreSectionAnchor } from "@/types/store";

/**
 * Converts a local-space rectangle (relative to a section anchor) into a
 * world-space AABB collider. Only correct for axis-aligned rotations
 * (multiples of 90°) — which is all the layout engine ever produces.
 */
export function localRectToWorldAabb(
  id: string,
  anchor: StoreSectionAnchor,
  localCenterX: number,
  localCenterZ: number,
  localWidth: number,
  localDepth: number
): AabbCollider {
  const cos = Math.round(Math.cos(anchor.rotationY));
  const sin = Math.round(Math.sin(anchor.rotationY));

  const worldHalfWidth = Math.abs(cos) * (localWidth / 2) + Math.abs(sin) * (localDepth / 2);
  const worldHalfDepth = Math.abs(sin) * (localWidth / 2) + Math.abs(cos) * (localDepth / 2);

  // Matches three.js's Y-axis rotation matrix: x' = x·cosθ + z·sinθ, z' = -x·sinθ + z·cosθ.
  const worldCenterX = anchor.position[0] + (localCenterX * cos + localCenterZ * sin);
  const worldCenterZ = anchor.position[2] + (-localCenterX * sin + localCenterZ * cos);

  return {
    id,
    minX: worldCenterX - worldHalfWidth,
    maxX: worldCenterX + worldHalfWidth,
    minZ: worldCenterZ - worldHalfDepth,
    maxZ: worldCenterZ + worldHalfDepth,
  };
}
