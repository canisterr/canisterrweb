const STORAGE_PROBE_KEY = "__cineparte_storage_probe__";

const CACHE_PREFIXES = ["cp_", "tmdb-search:", "tv-search:", "tv-browse:"];
const CACHE_EXACT_KEYS = ["cineparte.search.recent", "cine_search_history", "canisterr_seen_push_notifications"];
const CACHE_FALLBACK_PREFIXES = ["share-recipient-priority:", "notif_seen_"];
const LAST_RESORT_PREFIXES = ["canisterr_current_user:"];

let nativeStorageGetItem: Storage["getItem"] | null = null;
let nativeStorageSetItem: Storage["setItem"] | null = null;
let nativeStorageRemoveItem: Storage["removeItem"] | null = null;
let nativeStorageKey: Storage["key"] | null = null;
let quotaGuardInstalled = false;
let quotaRecoveryActive = false;

function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof Storage !== "undefined" && typeof window.localStorage !== "undefined";
}

function captureNativeStorageMethods(): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  if (!nativeStorageGetItem || !nativeStorageSetItem || !nativeStorageRemoveItem || !nativeStorageKey) {
    nativeStorageGetItem = Storage.prototype.getItem;
    nativeStorageSetItem = Storage.prototype.setItem;
    nativeStorageRemoveItem = Storage.prototype.removeItem;
    nativeStorageKey = Storage.prototype.key;
  }

  return true;
}

function getStorageLength(): number {
  return isBrowserStorageAvailable() ? window.localStorage.length : 0;
}

function readLocalStorageRaw(key: string): string | null {
  if (!captureNativeStorageMethods() || !nativeStorageGetItem) {
    return null;
  }

  return nativeStorageGetItem.call(window.localStorage, key);
}

function writeLocalStorageRaw(key: string, value: string): void {
  if (!captureNativeStorageMethods() || !nativeStorageSetItem) {
    throw new Error("localStorage is unavailable");
  }

  nativeStorageSetItem.call(window.localStorage, key, value);
}

function removeLocalStorageRaw(key: string): void {
  if (!captureNativeStorageMethods() || !nativeStorageRemoveItem) {
    return;
  }

  nativeStorageRemoveItem.call(window.localStorage, key);
}

function getLocalStorageKey(index: number): string | null {
  if (!captureNativeStorageMethods() || !nativeStorageKey) {
    return null;
  }

  return nativeStorageKey.call(window.localStorage, index);
}

export function isStorageQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;
}

function canUseLocalStorage(): boolean {
  if (!captureNativeStorageMethods()) {
    return false;
  }

  try {
    readLocalStorageRaw(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function hasPrefixMatch(key: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

function isDiscardableQuotaWrite(key: string): boolean {
  return key.startsWith("firebase:");
}

function readExpiresAt(raw: string | null): number | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { expiresAt?: unknown };
    return typeof parsed?.expiresAt === "number" ? parsed.expiresAt : null;
  } catch {
    return null;
  }
}

function removeKeys(keys: string[]): void {
  for (const key of keys) {
    try {
      removeLocalStorageRaw(key);
    } catch {
      // Ignore storage failures during cleanup.
    }
  }
}

function getStorageKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < getStorageLength(); index += 1) {
    const key = getLocalStorageKey(index);
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

function clearExpiredCacheEntries(preserveKeys: Set<string>): void {
  const now = Date.now();
  const keysToRemove = getStorageKeys().filter((key) => {
    if (preserveKeys.has(key) || !hasPrefixMatch(key, CACHE_PREFIXES)) {
      return false;
    }

    const expiresAt = readExpiresAt(readLocalStorageRaw(key));
    return expiresAt === null || expiresAt <= now;
  });

  removeKeys(keysToRemove);
}

function clearKnownCacheEntries(prefixes: string[], exactKeys: string[], preserveKeys: Set<string>): void {
  const keysToRemove = getStorageKeys().filter((key) => {
    if (preserveKeys.has(key)) {
      return false;
    }

    return exactKeys.includes(key) || hasPrefixMatch(key, prefixes);
  });

  removeKeys(keysToRemove);
}

function tryStorageProbe(): boolean {
  try {
    writeLocalStorageRaw(STORAGE_PROBE_KEY, "1");
    removeLocalStorageRaw(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function clearLargestEntries(preserveKeys: Set<string>): boolean {
  const candidates = getStorageKeys()
    .filter((key) => !preserveKeys.has(key) && !key.startsWith("firebase:"))
    .map((key) => ({
      key,
      size: (readLocalStorageRaw(key) || "").length,
    }))
    .sort((left, right) => right.size - left.size);

  for (const candidate of candidates) {
    removeKeys([candidate.key]);
    if (tryStorageProbe()) {
      return true;
    }
  }

  return false;
}

export function ensureLocalStorageHeadroom(options?: { preserveKeys?: string[] }): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  if (tryStorageProbe()) {
    return true;
  }

  const preserveKeys = new Set(options?.preserveKeys ?? []);

  clearExpiredCacheEntries(preserveKeys);
  if (tryStorageProbe()) {
    return true;
  }

  clearKnownCacheEntries(CACHE_PREFIXES, CACHE_EXACT_KEYS, preserveKeys);
  if (tryStorageProbe()) {
    return true;
  }

  clearKnownCacheEntries(CACHE_FALLBACK_PREFIXES, [], preserveKeys);
  if (tryStorageProbe()) {
    return true;
  }

  clearKnownCacheEntries(LAST_RESORT_PREFIXES, [], preserveKeys);
  if (tryStorageProbe()) {
    return true;
  }

  return clearLargestEntries(preserveKeys);
}

export function installLocalStorageQuotaGuard(): void {
  if (!captureNativeStorageMethods() || quotaGuardInstalled || !nativeStorageSetItem) {
    return;
  }

  quotaGuardInstalled = true;

  Storage.prototype.setItem = function guardedStorageSetItem(key: string, value: string): void {
    if (this !== window.localStorage) {
      nativeStorageSetItem!.call(this, key, value);
      return;
    }

    try {
      nativeStorageSetItem!.call(this, key, value);
    } catch (error) {
      if (quotaRecoveryActive || !isStorageQuotaExceeded(error)) {
        throw error;
      }

      quotaRecoveryActive = true;

      try {
        ensureLocalStorageHeadroom({ preserveKeys: [key] });
        try {
          nativeStorageSetItem!.call(this, key, value);
        } catch (retryError) {
          if (isDiscardableQuotaWrite(key) && isStorageQuotaExceeded(retryError)) {
            return;
          }

          throw retryError;
        }
      } finally {
        quotaRecoveryActive = false;
      }
    }
  };
}

export function setLocalStorageItemWithRecovery(key: string, value: string): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  try {
    writeLocalStorageRaw(key, value);
    return true;
  } catch (error) {
    if (!isStorageQuotaExceeded(error)) {
      return false;
    }

    ensureLocalStorageHeadroom({ preserveKeys: [key] });

    try {
      writeLocalStorageRaw(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
