"use client";

import { useMemo } from "react";
import MovieCase from "./MovieCase";
import {
  CASE_HEIGHT,
  SHELF_PLANK_GEOMETRY,
  SHELF_PLANK_MATERIAL,
  SHELF_UPRIGHT_GEOMETRY,
  SHELF_UPRIGHT_MATERIAL,
} from "./shared-resources";
import type { StoreMovieSummary } from "@/types/store";

const ITEMS_PER_ROW = 8;
const CASE_SPACING = 0.82;
const ROW_HEIGHT = 1.18;
const BASE_Y = 0.72;

/** Y of the topmost case's top edge for a shelf with this many items — use to clear signage above it. */
export function getShelfTopY(itemCount: number): number {
  if (itemCount <= 0) return BASE_Y;
  const rowCount = Math.ceil(itemCount / ITEMS_PER_ROW);
  return BASE_Y + (rowCount - 1) * ROW_HEIGHT + CASE_HEIGHT / 2;
}

interface MovieShelfProps {
  movies: StoreMovieSummary[];
  /** Local position within the aisle group — different shelves sit side by side along X. */
  position: [number, number, number];
}

/** One shelf definition's worth of cases, arranged in rows on a shared wood-plank frame. */
export default function MovieShelf({ movies, position }: MovieShelfProps) {
  const rows = useMemo(() => {
    const chunks: StoreMovieSummary[][] = [];
    for (let i = 0; i < movies.length; i += ITEMS_PER_ROW) {
      chunks.push(movies.slice(i, i + ITEMS_PER_ROW));
    }
    return chunks;
  }, [movies]);

  if (rows.length === 0) return null;

  const shelfWidth = Math.max(...rows.map((row) => row.length)) * CASE_SPACING + 0.3;
  const totalHeight = rows.length * ROW_HEIGHT + 0.4;

  return (
    <group position={position}>
      {rows.map((rowMovies, rowIndex) => {
        const y = BASE_Y + rowIndex * ROW_HEIGHT;
        const offset = -((rowMovies.length - 1) * CASE_SPACING) / 2;
        return (
          <group key={rowIndex}>
            <mesh
              geometry={SHELF_PLANK_GEOMETRY}
              material={SHELF_PLANK_MATERIAL}
              position={[0, y - 0.53, 0]}
              scale={[shelfWidth, 1, 1]}
            />
            {rowMovies.map((movie, i) => (
              <MovieCase key={movie.id} movie={movie} position={[offset + i * CASE_SPACING, y, 0]} />
            ))}
          </group>
        );
      })}
      <mesh
        geometry={SHELF_UPRIGHT_GEOMETRY}
        material={SHELF_UPRIGHT_MATERIAL}
        position={[-shelfWidth / 2, totalHeight / 2 - 0.6, 0]}
        scale={[1, totalHeight, 1]}
      />
      <mesh
        geometry={SHELF_UPRIGHT_GEOMETRY}
        material={SHELF_UPRIGHT_MATERIAL}
        position={[shelfWidth / 2, totalHeight / 2 - 0.6, 0]}
        scale={[1, totalHeight, 1]}
      />
    </group>
  );
}
