import * as THREE from "three";

/**
 * Geometries/materials shared across every shelf and case in the store.
 * Created once at module scope (not per-component) so hundreds of cases
 * reuse the same GPU buffers instead of allocating their own.
 */
export const CASE_WIDTH = 0.68;
export const CASE_HEIGHT = 1.02;
export const CASE_DEPTH = 0.06;

export const CASE_GEOMETRY = new THREE.BoxGeometry(CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH);

/** Slimmer, unlit-face boxes stacked behind the front case so a shelf slot reads as a stack of copies, not one floating card. */
export const STACK_COPY_DEPTH = 0.045;
export const STACK_COPY_GEOMETRY = new THREE.BoxGeometry(CASE_WIDTH * 0.97, CASE_HEIGHT * 0.97, STACK_COPY_DEPTH);
export const STACK_COPY_MATERIAL = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.55, metalness: 0.15 });

export const SHELF_PLANK_GEOMETRY = new THREE.BoxGeometry(1, 0.05, 0.42);
export const SHELF_PLANK_MATERIAL = new THREE.MeshStandardMaterial({ color: "#241c15", roughness: 0.82, metalness: 0.08 });

export const SHELF_UPRIGHT_GEOMETRY = new THREE.BoxGeometry(0.07, 1, 0.42);
export const SHELF_UPRIGHT_MATERIAL = new THREE.MeshStandardMaterial({ color: "#171310", roughness: 0.75, metalness: 0.12 });
