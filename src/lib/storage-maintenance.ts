const STORAGE_PROBE_KEY = "__cineparte_storage_probe__";

const CACHE_PREFIXES = ["cp_", "tmdb-search:", "tv-search:", "tv-browse:"];
const CACHE_EXACT_KEYS = ["cineparte.search.recent", "cine_search_history", "canisterr_seen_push_notifications"];
const CACHE_FALLBACK_PREFIXES = ["cinepost-feed-seen:", "share-recipient-priority:", "notif_seen_"];
const LAST_RESORT_PREFIXES = ["canisterr_current_user:"];

function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isStorageQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;
}

function canUseLocalStorage(): boolean {
  if (!isBrowserStorageAvailable()) {
    return false;
  }

  try {
    window.localStorage.getItem(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function hasPrefixMatch(key: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
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
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage failures during cleanup.
    }
  }
}

function getStorageKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
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

    const expiresAt = readExpiresAt(window.localStorage.getItem(key));
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
    window.localStorage.setItem(STORAGE_PROBE_KEY, "1");
    window.localStorage.removeItem(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
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
  return tryStorageProbe();
}

export function setLocalStorageItemWithRecovery(key: string, value: string): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isStorageQuotaExceeded(error)) {
      return false;
    }

    ensureLocalStorageHeadroom({ preserveKeys: [key] });

    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
