"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import SignageText from "./SignageText";
import MovieShelf, { getShelfTopY, getShelfWidth } from "./MovieShelf";
import { useSectionActive } from "@/hooks/store/useSectionActive";
import { useStoreSectionMovies, type ResolvedShelf } from "@/hooks/store/useStoreSectionMovies";
import { useRegisterCollider } from "../collision-registry";
import { localRectToWorldAabb } from "@/lib/store/collision-math";
import type { PersonalizedSectionConfig, SectionMood, StoreSectionAnchor, StoreSectionConfig } from "@/types/store";

const MAX_SHELVES_PER_ROW = 3;
const SHELF_GAP = 0.9;
const ROW_DEPTH_STEP = 3.6;
const SHELF_Z = -1.7;
const WALL_DEPTH = 0.2;

const MOOD_BACKER_COLOR: Record<SectionMood, string> = {
  neutral: "#453a2c",
  dark: "#2b2230",
  cool: "#243b44",
  warm: "#4a3018",
  vibrant: "#493014",
  vintage: "#3f3322",
};

interface AisleSectionProps {
  section: StoreSectionConfig | PersonalizedSectionConfig;
  anchor: StoreSectionAnchor;
  userId: string | null;
}

interface ShelfPlacement {
  shelf: ResolvedShelf;
  x: number;
  z: number;
  labelY: number;
}

/** Lays shelves out left-to-right, wrapping to a row further back whenever a row would
 *  exceed MAX_SHELVES_PER_ROW — guarantees shelves never overlap regardless of item count. */
function layoutShelves(shelves: ResolvedShelf[]): { placements: ShelfPlacement[]; maxRowWidth: number; rowCount: number } {
  const rows: ResolvedShelf[][] = [];
  for (let i = 0; i < shelves.length; i += MAX_SHELVES_PER_ROW) {
    rows.push(shelves.slice(i, i + MAX_SHELVES_PER_ROW));
  }

  const placements: ShelfPlacement[] = [];
  let maxRowWidth = 0;

  rows.forEach((rowShelves, rowIndex) => {
    const widths = rowShelves.map((shelf) => getShelfWidth(shelf.movies.length));
    const rowWidth = widths.reduce((sum, w) => sum + w, 0) + SHELF_GAP * Math.max(0, rowShelves.length - 1);
    maxRowWidth = Math.max(maxRowWidth, rowWidth);

    let cursor = -rowWidth / 2;
    rowShelves.forEach((shelf, i) => {
      const width = widths[i];
      const centerX = cursor + width / 2;
      cursor += width + SHELF_GAP;
      placements.push({
        shelf,
        x: centerX,
        z: SHELF_Z - rowIndex * ROW_DEPTH_STEP,
        labelY: getShelfTopY(shelf.movies.length) + 0.38,
      });
    });
  });

  return { placements, maxRowWidth, rowCount: rows.length };
}

export default function AisleSection({ section, anchor, userId }: AisleSectionProps) {
  const active = useSectionActive(anchor);
  const { shelves, requiresSignIn } = useStoreSectionMovies(section, userId, active);

  const nonEmptyShelves = useMemo(() => shelves.filter((shelf) => shelf.movies.length > 0), [shelves]);
  const { placements, maxRowWidth, rowCount } = useMemo(() => layoutShelves(nonEmptyShelves), [nonEmptyShelves]);

  const totalWidth = Math.max(maxRowWidth, 3);
  const totalDepth = Math.max(1, rowCount) * ROW_DEPTH_STEP + 1;

  // One bounding collider across the whole (possibly multi-row) shelf footprint.
  const wallCollider = useMemo(
    () => localRectToWorldAabb(`${section.id}-wall`, anchor, 0, SHELF_Z - totalDepth / 2 + ROW_DEPTH_STEP / 2, totalWidth + 0.6, totalDepth),
    [section.id, anchor, totalWidth, totalDepth]
  );
  useRegisterCollider(active ? wallCollider : null);

  const backerColor = MOOD_BACKER_COLOR[section.mood];

  // Signage must clear whatever the tallest shelf actually ends up being (shelves can be
  // 1-3 rows depending on item count) — otherwise the top row of posters covers the title.
  const maxShelfTopY = Math.max(getShelfTopY(0), ...nonEmptyShelves.map((shelf) => getShelfTopY(shelf.movies.length)));
  const sectionSignageY = Math.max(4.1, maxShelfTopY + 1);
  const backerWallHeight = Math.max(5.2, sectionSignageY + 1);
  const backerZ = SHELF_Z - (rowCount - 1) * ROW_DEPTH_STEP - 0.65;

  return (
    <group position={anchor.position} rotation={[0, anchor.rotationY, 0]}>
      <mesh position={[0, backerWallHeight / 2 - 0.3, backerZ]} receiveShadow={false}>
        <boxGeometry args={[totalWidth + 1, backerWallHeight, WALL_DEPTH]} />
        <meshStandardMaterial color={backerColor} roughness={0.95} side={DoubleSide} />
      </mesh>

      <SignageText text={section.signage} position={[0, sectionSignageY, SHELF_Z - 0.5]} size={active ? 0.62 : 0.55} />

      {requiresSignIn ? (
        <SignageText text="SIGN IN TO UNLOCK" position={[0, 1.6, SHELF_Z + 0.3]} size={0.28} color="#ffb36b" />
      ) : (
        placements.map(({ shelf, x, z, labelY }) => (
          <group key={shelf.id}>
            <SignageText text={shelf.label.toUpperCase()} position={[x, labelY, z + 0.32]} size={0.16} color="#c9c2ac" />
            <MovieShelf movies={shelf.movies} position={[x, 0, z]} />
          </group>
        ))
      )}
    </group>
  );
}
