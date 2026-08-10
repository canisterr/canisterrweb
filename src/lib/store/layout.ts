import { COLLECTION_SECTIONS, GENRE_SECTIONS } from "@/lib/store/shelf-config";
import { PERSONALIZED_SECTIONS } from "@/lib/store/personalized-config";
import type { StoreSectionAnchor } from "@/types/store";

/**
 * Deterministic floorplan generator. The store reads as one continuous
 * building: a central spine walkway from the entrance, personalized alcoves
 * and curated collections close by on either side, and the genre hall
 * extending further back in a compact double-row grid — architectural
 * "feels bigger than it is" rather than a sprawling literal map.
 */
const AISLE_WIDTH = 7;
const AISLE_DEPTH = 9;
// Wide enough that even a wrapped multi-row shelf layout (see AisleSection's layoutShelves)
// never spills into the next row/alcove — shelves used to overlap and z-fight at tighter spacing.
const GENRE_ROW_SPACING = 15;
const GENRE_COL_OFFSET = 9;
const GENRE_HALL_START_Z = -22;

const SIDE_ROOM_SPACING = 20;
const SIDE_ROOM_START_Z = -7;
/** How far a wrapped (multi-row) collection/personalized shelf stack can extend beyond its anchor. */
const SIDE_ROOM_MAX_DEPTH_EXTENT = 12;

export const ENTRANCE_ANCHOR: StoreSectionAnchor = {
  sectionId: "entrance",
  position: [0, 0, 6],
  rotationY: 0,
  width: 16,
  depth: 12,
};

function buildGenreAnchors(): StoreSectionAnchor[] {
  return GENRE_SECTIONS.map((section, index) => {
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? -1 : 1;
    return {
      sectionId: section.id,
      position: [side * GENRE_COL_OFFSET, 0, GENRE_HALL_START_Z - row * GENRE_ROW_SPACING],
      // Shelves always face back toward the central spine walkway.
      rotationY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      width: AISLE_WIDTH,
      depth: AISLE_DEPTH,
    };
  });
}

function buildCollectionAnchors(): StoreSectionAnchor[] {
  return COLLECTION_SECTIONS.map((section, index) => ({
    sectionId: section.id,
    position: [18, 0, SIDE_ROOM_START_Z - index * SIDE_ROOM_SPACING],
    rotationY: -Math.PI / 2,
    width: AISLE_WIDTH,
    depth: AISLE_DEPTH - 2,
  }));
}

function buildPersonalizedAnchors(): StoreSectionAnchor[] {
  return PERSONALIZED_SECTIONS.map((section, index) => ({
    sectionId: section.id,
    position: [-18, 0, SIDE_ROOM_START_Z - index * SIDE_ROOM_SPACING],
    rotationY: Math.PI / 2,
    width: AISLE_WIDTH,
    depth: AISLE_DEPTH - 2,
  }));
}

export const GENRE_ANCHORS = buildGenreAnchors();
export const COLLECTION_ANCHORS = buildCollectionAnchors();
export const PERSONALIZED_ANCHORS = buildPersonalizedAnchors();

export const ALL_SECTION_ANCHORS: StoreSectionAnchor[] = [
  ENTRANCE_ANCHOR,
  ...COLLECTION_ANCHORS,
  ...PERSONALIZED_ANCHORS,
  ...GENRE_ANCHORS,
];

export function getSectionAnchor(sectionId: string): StoreSectionAnchor | undefined {
  return ALL_SECTION_ANCHORS.find((anchor) => anchor.sectionId === sectionId);
}

const STAND_OFFSET = 3.6;

/** World-space point to teleport a player to so they land facing a section's shelves, not inside the wall. */
export function getSectionStandPoint(anchor: StoreSectionAnchor): [number, number, number] {
  if (anchor.sectionId === ENTRANCE_ANCHOR.sectionId) return anchor.position;

  const cos = Math.round(Math.cos(anchor.rotationY));
  const sin = Math.round(Math.sin(anchor.rotationY));
  // Local (0, +STAND_OFFSET) — the walkway side — rotated into world space.
  const worldX = anchor.position[0] + STAND_OFFSET * sin;
  const worldZ = anchor.position[2] + STAND_OFFSET * cos;
  return [worldX, 0, worldZ];
}

/** Overall floor bounds, used to size the environment floor/walls/ceiling. */
export function getStoreBounds() {
  const maxRow = Math.ceil(GENRE_SECTIONS.length / 2) - 1;
  const backZ = GENRE_HALL_START_Z - maxRow * GENRE_ROW_SPACING - AISLE_DEPTH;
  const frontZ = ENTRANCE_ANCHOR.position[2] + ENTRANCE_ANCHOR.depth / 2;
  const genreHalfWidth = GENRE_COL_OFFSET + AISLE_DEPTH;
  const sideRoomHalfWidth = 18 + SIDE_ROOM_MAX_DEPTH_EXTENT;
  const halfWidth = Math.max(genreHalfWidth, sideRoomHalfWidth);
  return {
    minX: -halfWidth,
    maxX: halfWidth,
    minZ: backZ,
    maxZ: frontZ,
  };
}
