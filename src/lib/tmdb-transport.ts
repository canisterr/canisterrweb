const TMDB_SERVER_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_PROXY_BASE_URL = "/api/tmdb";
// Only read server-side credentials. Browser calls go through /api/tmdb.
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN;
const TMDB_UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_UPSTREAM_CONCURRENCY = 8;
const MAX_CACHE_ENTRIES = 500;
let activeUpstreamRequests = 0;
let upstreamBlockedUntil = 0;
const upstreamWaiters: Array<() => void> = [];
const TMDB_IN_FLIGHT = new Map<string, Promise<Response>>();
const TMDB_RESPONSE_CACHE = new Map<
  string,
  {
    expiresAt: number;
    body: string;
    status: number;
    statusText: string;
    headers: [string, string][];
  }
>();

type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue>;

function isClientRuntime() {
  return typeof window !== "undefined";
}

function normalizePath(path: string) {
  return path.replace(/^\/+/, "");
}

function buildSearchParams(params?: QueryParams, includeApiKey: boolean = false) {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (key === "api_key" || value === undefined || value === null || value === "") return;
      searchParams.set(key, String(value));
    });
  }

  if (includeApiKey && !TMDB_BEARER_TOKEN && TMDB_API_KEY) {
    searchParams.set("api_key", TMDB_API_KEY);
  }

  searchParams.sort();
  return searchParams;
}

export function getTmdbCacheTtlSeconds(path: string) {
  if (path === "search/multi") return 6 * 60 * 60;
  if (path.startsWith("search/")) return 5 * 60;
  if (path.startsWith("trending/")) return 60 * 60;
  if (path.endsWith("/popular")) return 6 * 60 * 60;
  if (path.startsWith("genre/")) return 7 * 24 * 60 * 60;
  if (path.startsWith("discover/")) return 10 * 60;
  if (/^(?:movie|tv)\/\d+\/similar$/.test(path)) return 6 * 60 * 60;
  if (/^(movie|tv|person)\/\d+(?:\/|$)/.test(path)) return 24 * 60 * 60;
  if (path.startsWith("watch/providers/")) return 24 * 60 * 60;
  return 60 * 60;
}

async function withUpstreamSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeUpstreamRequests >= MAX_UPSTREAM_CONCURRENCY) {
    await new Promise<void>((resolve) => upstreamWaiters.push(resolve));
  } else {
    activeUpstreamRequests += 1;
  }
  try {
    return await work();
  } finally {
    const next = upstreamWaiters.shift();
    if (next) next();
    else activeUpstreamRequests -= 1;
  }
}

function buildCachedResponse(entry: {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
}, extraHeaders?: Record<string, string>) {
  const headers = new Headers(entry.headers);
  Object.entries(extraHeaders || {}).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
}

function buildUpstreamErrorResponse(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : "TMDB request failed";
  return new Response(
    JSON.stringify({
      error: "TMDB upstream unavailable",
      message,
      path: normalizePath(path),
    }),
    {
      status: 504,
      statusText: "Gateway Timeout",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export function buildTmdbUrl(path: string, params?: QueryParams) {
  const normalizedPath = normalizePath(path);
  const searchParams = buildSearchParams(params, !isClientRuntime());
  const queryString = searchParams.toString();
  const baseUrl = isClientRuntime() ? TMDB_PROXY_BASE_URL : TMDB_SERVER_BASE_URL;

  return `${baseUrl}/${normalizedPath}${queryString ? `?${queryString}` : ""}`;
}

export async function fetchTmdb(
  path: string,
  params?: QueryParams,
  init?: RequestInit
) {
  const url = buildTmdbUrl(path, params);
  const method = (init?.method || "GET").toUpperCase();

  if (method !== "GET" || init?.cache === "no-store" || init?.signal) {
    return fetch(url, {
      ...init,
      ...(!isClientRuntime() && TMDB_BEARER_TOKEN
        ? { headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), Authorization: `Bearer ${TMDB_BEARER_TOKEN}` } }
        : {}),
    });
  }

  const cacheKey = `${method}:${url}`;
  const cached = TMDB_RESPONSE_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return buildCachedResponse(cached, { "x-tmdb-cache": "hit" });
  }

  if (!isClientRuntime() && !TMDB_API_KEY && !TMDB_BEARER_TOKEN) {
    return Response.json({ error: "TMDB is not configured" }, { status: 503 });
  }

  if (upstreamBlockedUntil > now) {
    if (cached) return buildCachedResponse(cached, { "x-tmdb-cache": "stale", "x-tmdb-stale-reason": "rate-limited" });
    return Response.json({ error: "TMDB rate limited" }, {
      status: 429,
      headers: { "retry-after": String(Math.ceil((upstreamBlockedUntil - now) / 1000)), "cache-control": "no-store" },
    });
  }

  const inFlight = TMDB_IN_FLIGHT.get(cacheKey);
  if (inFlight) {
    const shared = await inFlight;
    const response = shared.clone();
    response.headers.set("x-tmdb-cache", "coalesced");
    return response;
  }

  const request = withUpstreamSlot(async () => {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TMDB_UPSTREAM_TIMEOUT_MS),
        ...(!isClientRuntime() ? {
          cache: "force-cache" as const,
          headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), ...(TMDB_BEARER_TOKEN ? { Authorization: `Bearer ${TMDB_BEARER_TOKEN}` } : {}) },
          next: { revalidate: getTmdbCacheTtlSeconds(normalizePath(path)) },
        } : {}),
      });
      const body = await response.text();

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        upstreamBlockedUntil = Date.now() + Math.min(60_000, Math.max(5_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000));
      }

      if (response.status === 429 && cached) {
        return buildCachedResponse(cached, {
          "x-tmdb-cache": "stale",
          "x-tmdb-stale-reason": "rate-limited",
        });
      }

      if (response.ok || response.status === 429) {
        if (TMDB_RESPONSE_CACHE.size >= MAX_CACHE_ENTRIES) {
          TMDB_RESPONSE_CACHE.delete(TMDB_RESPONSE_CACHE.keys().next().value!);
        }
        const retryAfter = Number(response.headers.get("retry-after"));
        const ttlMs = response.status === 429
          ? Math.min(60_000, Math.max(5_000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000))
          : getTmdbCacheTtlSeconds(normalizePath(path)) * 1000;
        TMDB_RESPONSE_CACHE.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          body,
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
        });
      }

      const upstreamHeaders = new Headers(response.headers);
      upstreamHeaders.set("x-tmdb-cache", "miss");
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: upstreamHeaders,
      });
    } catch (error) {
      if (cached) {
        return buildCachedResponse(cached, {
          "x-tmdb-cache": "stale",
          "x-tmdb-stale-reason": "upstream-error",
        });
      }

      return buildUpstreamErrorResponse(path, error);
    }
  });
  TMDB_IN_FLIGHT.set(cacheKey, request);
  try {
    return (await request).clone();
  } finally {
    TMDB_IN_FLIGHT.delete(cacheKey);
  }
}
