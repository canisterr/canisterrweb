import { setLocalStorageItemWithRecovery } from "./storage-maintenance";

const PREFIX = "cp_";

export function lsGet<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function lsSet<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  setLocalStorageItemWithRecovery(PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }));
}
