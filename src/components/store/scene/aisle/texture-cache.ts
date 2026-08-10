import * as THREE from "three";

interface CacheEntry {
  promise: Promise<THREE.Texture>;
  texture: THREE.Texture | null;
  refCount: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}

const cache = new Map<string, CacheEntry>();
const loader = new THREE.TextureLoader();
const DISPOSE_GRACE_MS = 15_000;

/**
 * Shared, ref-counted poster texture cache. Concurrent requests for the same
 * URL (e.g. two shelves featuring the same movie) share a single network
 * load; textures are only disposed once nothing references them anymore
 * (with a short grace period so quickly stepping away from and back to an
 * aisle doesn't thrash reload/dispose).
 */
export function acquireTexture(url: string): Promise<THREE.Texture> {
  let entry = cache.get(url);

  if (!entry) {
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          resolve(texture);
        },
        undefined,
        (error) => reject(error instanceof Error ? error : new Error("Texture load failed"))
      );
    });

    entry = { promise, texture: null, refCount: 0, disposeTimer: null };
    cache.set(url, entry);

    promise
      .then((texture) => {
        if (cache.get(url) === entry) entry!.texture = texture;
      })
      .catch(() => {
        // Rejection is surfaced to callers via the returned promise; nothing to cache.
      });
  }

  entry.refCount += 1;
  if (entry.disposeTimer) {
    clearTimeout(entry.disposeTimer);
    entry.disposeTimer = null;
  }

  return entry.promise;
}

export function releaseTexture(url: string) {
  const entry = cache.get(url);
  if (!entry) return;

  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount > 0) return;

  entry.disposeTimer = setTimeout(() => {
    const current = cache.get(url);
    if (current && current.refCount === 0) {
      current.texture?.dispose();
      cache.delete(url);
    }
  }, DISPOSE_GRACE_MS);
}
