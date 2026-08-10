"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import SignageText from "./SignageText";
import MovieShelf from "./MovieShelf";
import { useSectionActive } from "@/hooks/store/useSectionActive";
import { useStoreSectionMovies } from "@/hooks/store/useStoreSectionMovies";
import { useRegisterCollider } from "../collision-registry";
import { localRectToWorldAabb } from "@/lib/store/collision-math";
import type { PersonalizedSectionConfig, SectionMood, StoreSectionAnchor, StoreSectionConfig } from "@/types/store";

const SHELF_SLOT_WIDTH = 3.4;
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

export default function AisleSection({ section, anchor, userId }: AisleSectionProps) {
  const active = useSectionActive(anchor);
  const { shelves, requiresSignIn } = useStoreSectionMovies(section, userId, active);

  const shelfCount = Math.max(shelves.length, 1);
  const totalWidth = shelfCount * SHELF_SLOT_WIDTH;

  const wallCollider = useMemo(
    () => localRectToWorldAabb(`${section.id}-wall`, anchor, 0, SHELF_Z - 0.6, totalWidth, WALL_DEPTH),
    [section.id, anchor, totalWidth]
  );
  useRegisterCollider(active ? wallCollider : null);

  const backerColor = MOOD_BACKER_COLOR[section.mood];

  return (
    <group position={anchor.position} rotation={[0, anchor.rotationY, 0]}>
      <mesh position={[0, 2.2, SHELF_Z - 0.65]} receiveShadow={false}>
        <boxGeometry args={[totalWidth + 1, 4.6, WALL_DEPTH]} />
        <meshStandardMaterial color={backerColor} roughness={0.95} side={DoubleSide} />
      </mesh>

      <SignageText text={section.signage} position={[0, 3.55, SHELF_Z - 0.5]} size={active ? 0.62 : 0.55} />

      {requiresSignIn ? (
        <SignageText text="SIGN IN TO UNLOCK" position={[0, 1.6, SHELF_Z + 0.3]} size={0.28} color="#ffb36b" />
      ) : (
        shelves.map((shelf, index) => {
          const x = (index - (shelfCount - 1) / 2) * SHELF_SLOT_WIDTH;
          return shelf.movies.length > 0 ? (
            <group key={shelf.id}>
              <SignageText text={shelf.label.toUpperCase()} position={[x, 2.55, SHELF_Z + 0.32]} size={0.16} color="#c9c2ac" />
              <MovieShelf movies={shelf.movies} position={[x, 0, SHELF_Z]} />
            </group>
          ) : null;
        })
      )}
    </group>
  );
}
