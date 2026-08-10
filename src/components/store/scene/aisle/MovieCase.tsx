"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { usePosterTexture } from "./usePosterTexture";
import {
  CASE_DEPTH,
  CASE_GEOMETRY,
  CASE_WIDTH,
  STACK_COPY_DEPTH,
  STACK_COPY_GEOMETRY,
  STACK_COPY_MATERIAL,
} from "./shared-resources";
import { getShelfPosterUrl } from "@/lib/store/discover";
import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS } from "@/lib/store/quality";
import { trackStoreEvent } from "@/lib/store/analytics";
import type { StoreMovieSummary } from "@/types/store";

const NEAR_DISTANCE = 9;
const FAR_DISTANCE = 13;
const LOD_CHECK_INTERVAL_S = 0.5;
const HOVER_FORWARD_OFFSET = 0.22;
const HOVER_SCALE = 1.08;
const DAMP_SPEED = 8;

interface MovieCaseProps {
  movie: StoreMovieSummary;
  position: [number, number, number];
}

/** A single poster case with real depth, cached/LOD'd texture loading, and an elegant hover/select nudge. */
export default function MovieCase({ movie, position }: MovieCaseProps) {
  const baseGroupRef = useRef<THREE.Group>(null);
  const animatedGroupRef = useRef<THREE.Group>(null);
  const frontMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const distanceCheckClock = useRef(0);
  const worldPositionScratch = useRef(new THREE.Vector3());

  const [hovered, setHovered] = useState(false);
  const [distanceTier, setDistanceTier] = useState<"near" | "far">("near");

  const selectMovie = useStoreScene((s) => s.selectMovie);
  const isSelected = useStoreScene((s) => s.selectedMovieId === movie.id);
  const nearSize = useStoreScene((s) => QUALITY_PRESETS[s.qualityTier].nearPosterSize);
  const farSize = useStoreScene((s) => QUALITY_PRESETS[s.qualityTier].farPosterSize);

  // Small deterministic per-title jitter so a shelf of stacks doesn't look perfectly machine-aligned.
  const stackJitter = useMemo(() => {
    const jx = (((movie.id * 928371) % 1000) / 1000 - 0.5) * 0.05;
    const jy = (((movie.id * 552383) % 1000) / 1000 - 0.5) * 0.03;
    return { jx, jy };
  }, [movie.id]);

  const hasPoster = Boolean(movie.posterPath || movie.posterUrl);
  const posterUrl = hasPoster ? getShelfPosterUrl(movie, distanceTier === "near" ? nearSize : farSize) : null;
  const { texture, status } = usePosterTexture(posterUrl);

  const materials = useMemo(() => {
    const frameMat = new THREE.MeshStandardMaterial({ color: "#171310", roughness: 0.85, metalness: 0.05 });
    const frontMat = new THREE.MeshStandardMaterial({
      color: status === "loaded" ? "#ffffff" : "#221f1a",
      map: status === "loaded" ? texture : null,
      roughness: 0.5,
      metalness: 0.04,
      emissive: new THREE.Color("#ff7a1a"),
      emissiveIntensity: 0,
    });
    // BoxGeometry material order is [+x,-x,+y,-y,+z,-z]; the +z face is the
    // one visible from the walkway side given how aisles are oriented.
    return [frameMat, frameMat, frameMat, frameMat, frontMat, frameMat];
  }, [texture, status]);

  useEffect(() => {
    frontMaterialRef.current = materials[4];
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  useFrame((frameState, delta) => {
    distanceCheckClock.current += delta;
    if (distanceCheckClock.current >= LOD_CHECK_INTERVAL_S && baseGroupRef.current) {
      distanceCheckClock.current = 0;
      baseGroupRef.current.getWorldPosition(worldPositionScratch.current);
      const distance = frameState.camera.position.distanceTo(worldPositionScratch.current);
      setDistanceTier((prev) => {
        if (prev === "far" && distance < NEAR_DISTANCE) return "near";
        if (prev === "near" && distance > FAR_DISTANCE) return "far";
        return prev;
      });
    }

    const active = hovered || isSelected;
    if (animatedGroupRef.current) {
      animatedGroupRef.current.position.z = THREE.MathUtils.damp(
        animatedGroupRef.current.position.z,
        active ? HOVER_FORWARD_OFFSET : 0,
        DAMP_SPEED,
        delta
      );
      const scale = THREE.MathUtils.damp(animatedGroupRef.current.scale.x, active ? HOVER_SCALE : 1, DAMP_SPEED, delta);
      animatedGroupRef.current.scale.setScalar(scale);
    }
    const frontMaterial = frontMaterialRef.current;
    if (frontMaterial) {
      frontMaterial.emissiveIntensity = THREE.MathUtils.damp(frontMaterial.emissiveIntensity, active ? 0.22 : 0, DAMP_SPEED, delta);
    }
  });

  const selectThisMovie = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    selectMovie(movie.id);
    trackStoreEvent("movie_selected_from_store", { movie_id: movie.id });
  };

  return (
    <group ref={baseGroupRef} position={position}>
      {/* Extra copies stacked behind the front case — stay put on the shelf when the front one pulls forward on hover. */}
      <mesh
        geometry={STACK_COPY_GEOMETRY}
        material={STACK_COPY_MATERIAL}
        position={[stackJitter.jx * 0.6, stackJitter.jy * 0.6, -CASE_DEPTH / 2 - STACK_COPY_DEPTH / 2 - 0.008]}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={selectThisMovie}
      />
      <mesh
        geometry={STACK_COPY_GEOMETRY}
        material={STACK_COPY_MATERIAL}
        position={[stackJitter.jx, stackJitter.jy, -CASE_DEPTH / 2 - STACK_COPY_DEPTH * 1.5 - 0.024]}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={selectThisMovie}
      />

      <group ref={animatedGroupRef}>
        <mesh
          geometry={CASE_GEOMETRY}
          material={materials}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={selectThisMovie}
        />
        {(!hasPoster || status === "error") && (
          <Text
            position={[0, 0, CASE_DEPTH / 2 + 0.002]}
            fontSize={0.075}
            maxWidth={CASE_WIDTH * 0.85}
            color="#f5f0de"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
          >
            {movie.title}
          </Text>
        )}
      </group>
    </group>
  );
}
