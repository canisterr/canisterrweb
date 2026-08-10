"use client";

import MovieShelf from "./aisle/MovieShelf";
import MovieCase from "./aisle/MovieCase";
import SignageText from "./aisle/SignageText";
import { useStoreSectionMovies } from "@/hooks/store/useStoreSectionMovies";
import { COLLECTION_SECTIONS } from "@/lib/store/shelf-config";
import { ENTRANCE_ANCHOR } from "@/lib/store/layout";

const SPOTLIGHT_SECTION = COLLECTION_SECTIONS.find((section) => section.id === "collection-spotlight")!;

/** The lobby: a big featured case plus a trending strip, so the store reads as a movie store within seconds. */
export default function StoreEntrance({ userId }: { userId: string | null }) {
  const { shelves } = useStoreSectionMovies(SPOTLIGHT_SECTION, userId, true);
  const trending = shelves.find((shelf) => shelf.id === "trending")?.movies ?? [];
  const featured = trending[0];
  const rest = trending.slice(1, 9);

  return (
    <group position={ENTRANCE_ANCHOR.position}>
      {/* Backer + flanking walls so the lobby reads as an enclosed room from the moment you spawn. */}
      <mesh position={[0, 2.4, -4.4]}>
        <boxGeometry args={[14, 5.2, 0.3]} />
        <meshStandardMaterial color="#3a2f22" roughness={0.9} />
      </mesh>
      <mesh position={[-7, 2.4, -1.5]}>
        <boxGeometry args={[0.3, 5.2, 6]} />
        <meshStandardMaterial color="#4d3f2e" roughness={0.9} />
      </mesh>
      <mesh position={[7, 2.4, -1.5]}>
        <boxGeometry args={[0.3, 5.2, 6]} />
        <meshStandardMaterial color="#4d3f2e" roughness={0.9} />
      </mesh>

      <SignageText text="CANISTERR" position={[0, 3.6, -2]} size={0.85} color="#ff9a52" />
      <SignageText text="THE MOVIE STORE" position={[0, 2.95, -2]} size={0.26} color="#f5f0de" />

      {featured && (
        <group position={[0, 1.55, -3.6]} scale={2.1}>
          <MovieCase movie={featured} position={[0, 0, 0]} />
        </group>
      )}

      {rest.length > 0 && (
        <group position={[0, 0, 1.6]}>
          <SignageText text="TRENDING NOW" position={[0, 2.5, -1.68]} size={0.2} color="#c9c2ac" />
          <MovieShelf movies={rest} position={[0, 0, -1.7]} />
        </group>
      )}
    </group>
  );
}
