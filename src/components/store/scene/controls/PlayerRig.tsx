"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useCollisionRegistry } from "../collision-registry";
import { useStoreScene, useStoreControlsPaused } from "@/lib/store/store-state";
import { useReducedMotion } from "@/hooks/store/useReducedMotion";
import type { AabbCollider } from "@/types/store";
import type { MovementInputState } from "./movement-input";

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 3.4;
const MOVE_TARGET_SPEED = 3;
const ACCEL = 8;
const ARRIVE_DIST = 0.35;
const TELEPORT_DURATION_MS = 900;
const POSITION_SYNC_THRESHOLD_SQ = 0.25;
const MAX_PITCH = 0.5;
// How fast the rendered look direction chases the input-accumulated target. High enough to
// feel responsive to a continuous drag, but smooths out uneven/bursty touch-event timing
// (mobile swipes were snapping the camera one event-batch at a time without this).
const LOOK_SMOOTHING = 22;

function collidesAt(x: number, z: number, colliders: AabbCollider[], radius: number): boolean {
  for (const collider of colliders) {
    if (x > collider.minX - radius && x < collider.maxX + radius && z > collider.minZ - radius && z < collider.maxZ + radius) {
      return true;
    }
  }
  return false;
}

interface PlayerRigProps {
  inputRef: MutableRefObject<MovementInputState>;
  initialPosition?: [number, number];
}

/** Owns camera position/orientation: walk physics, collision resolution, and eased teleport travel. */
export default function PlayerRig({ inputRef, initialPosition = [0, 12] }: PlayerRigProps) {
  const { camera } = useThree();
  const registry = useCollisionRegistry();
  const reducedMotion = useReducedMotion();

  const position = useRef(new THREE.Vector3(initialPosition[0], EYE_HEIGHT, initialPosition[1]));
  const velocity = useRef(new THREE.Vector3());
  const yaw = useRef(0); // 0 faces -Z, which is "into the store" per the layout engine
  const pitch = useRef(0);
  const targetYaw = useRef(0); // accumulates raw input instantly; yaw/pitch above ease toward these each frame
  const targetPitch = useRef(0);
  const teleport = useRef<{ from: THREE.Vector3; to: THREE.Vector3; startedAt: number } | null>(null);
  const lastSynced = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));

  const setPlayerPosition = useStoreScene((s) => s.setPlayerPosition);
  const teleportRequest = useStoreScene((s) => s.teleportRequest);
  const clearTeleport = useStoreScene((s) => s.clearTeleport);
  const controlsPaused = useStoreControlsPaused();

  useEffect(() => {
    if (!teleportRequest) return;
    const to = new THREE.Vector3(teleportRequest.position[0], EYE_HEIGHT, teleportRequest.position[2]);
    inputRef.current.moveTarget = null;

    if (teleportRequest.immediate || reducedMotion) {
      position.current.copy(to);
      velocity.current.set(0, 0, 0);
      clearTeleport();
      return;
    }

    teleport.current = { from: position.current.clone(), to, startedAt: performance.now() };
  }, [teleportRequest, reducedMotion, clearTeleport, inputRef]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);

    targetYaw.current += inputRef.current.yawDelta;
    inputRef.current.yawDelta = 0;
    targetPitch.current = THREE.MathUtils.clamp(targetPitch.current + inputRef.current.pitchDelta, -MAX_PITCH, MAX_PITCH);
    inputRef.current.pitchDelta = 0;

    yaw.current = THREE.MathUtils.damp(yaw.current, targetYaw.current, LOOK_SMOOTHING, delta);
    pitch.current = THREE.MathUtils.damp(pitch.current, targetPitch.current, LOOK_SMOOTHING, delta);

    if (teleport.current) {
      const { from, to, startedAt } = teleport.current;
      const t = Math.min(1, (performance.now() - startedAt) / TELEPORT_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      position.current.lerpVectors(from, to, eased);
      velocity.current.set(0, 0, 0);
      if (t >= 1) {
        teleport.current = null;
        clearTeleport();
      }
    } else if (!controlsPaused) {
      let targetVelocity = new THREE.Vector3();

      if (inputRef.current.moveTarget) {
        const [tx, tz] = inputRef.current.moveTarget;
        const dx = tx - position.current.x;
        const dz = tz - position.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist < ARRIVE_DIST) {
          inputRef.current.moveTarget = null;
        } else {
          targetVelocity = new THREE.Vector3(dx / dist, 0, dz / dist).multiplyScalar(MOVE_TARGET_SPEED);
        }
      } else if (inputRef.current.forward !== 0 || inputRef.current.strafe !== 0) {
        const forwardVec = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current)).multiplyScalar(
          -inputRef.current.forward
        );
        const strafeVec = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current)).multiplyScalar(
          inputRef.current.strafe
        );
        const combined = forwardVec.add(strafeVec);
        if (combined.lengthSq() > 1) combined.normalize();
        targetVelocity = combined.multiplyScalar(WALK_SPEED);
      }

      const smoothing = 1 - Math.exp(-ACCEL * delta);
      velocity.current.lerp(targetVelocity, smoothing);

      if (velocity.current.lengthSq() > 1e-5) {
        const bounds = registry.getAll();
        const nextX = position.current.x + velocity.current.x * delta;
        const nextZ = position.current.z + velocity.current.z * delta;

        if (!collidesAt(nextX, position.current.z, bounds, PLAYER_RADIUS)) {
          position.current.x = nextX;
        } else {
          velocity.current.x = 0;
        }
        if (!collidesAt(position.current.x, nextZ, bounds, PLAYER_RADIUS)) {
          position.current.z = nextZ;
        } else {
          velocity.current.z = 0;
        }
      }
    }

    camera.position.copy(position.current);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw.current);
    camera.rotateX(pitch.current);

    if (position.current.distanceToSquared(lastSynced.current) > POSITION_SYNC_THRESHOLD_SQ) {
      lastSynced.current.copy(position.current);
      setPlayerPosition([position.current.x, position.current.y, position.current.z]);
    }
  });

  return null;
}
