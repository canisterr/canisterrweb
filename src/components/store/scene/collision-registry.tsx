"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AabbCollider } from "@/types/store";

/**
 * Lightweight AABB collider registry. Deliberately NOT React state — shelves
 * and walls register once on mount and PlayerRig reads the live list every
 * frame inside useFrame, so this needs to avoid triggering re-renders.
 */
class ColliderRegistry {
  private colliders = new Map<string, AabbCollider>();

  register(collider: AabbCollider) {
    this.colliders.set(collider.id, collider);
  }

  unregister(id: string) {
    this.colliders.delete(id);
  }

  getAll(): AabbCollider[] {
    return Array.from(this.colliders.values());
  }
}

const CollisionContext = createContext<ColliderRegistry | null>(null);

export function CollisionProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new ColliderRegistry());
  return <CollisionContext.Provider value={registry}>{children}</CollisionContext.Provider>;
}

export function useCollisionRegistry(): ColliderRegistry {
  const registry = useContext(CollisionContext);
  if (!registry) throw new Error("useCollisionRegistry must be used within a CollisionProvider");
  return registry;
}

/** Registers a static collider for the lifetime of the component. Pass a memoized collider. */
export function useRegisterCollider(collider: AabbCollider | null) {
  const registry = useCollisionRegistry();

  useEffect(() => {
    if (!collider) return;
    registry.register(collider);
    return () => registry.unregister(collider.id);
  }, [registry, collider]);
}
