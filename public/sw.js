/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC_RylgN_XYnCFcUo-n9vSNWddwHHzwqqU",
  authDomain: "filmshare-72c31.firebaseapp.com",
  projectId: "filmshare-72c31",
  databaseURL: "https://filmshare-72c31-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "filmshare-72c31.appspot.com",
  messagingSenderId: "203083828735",
  appId: "1:203083828735:web:aa6b5aee894df6d39febca",
});

const messaging = firebase.messaging();
const SEEN_NOTIFICATION_KEY = "__canisterr_seen_push_notifications__";
const SEEN_NOTIFICATION_TTL_MS = 15000;

// Bump this whenever the caching strategy below changes so old cache
// contents don't linger across deploys.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `canisterr-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `canisterr-images-${CACHE_VERSION}`;
const API_CACHE = `canisterr-api-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([STATIC_CACHE, IMAGE_CACHE, API_CACHE]);
const OFFLINE_URL = "/offline";
const MAX_IMAGE_ENTRIES = 250;
const MAX_API_ENTRIES = 200;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i += 1) {
    await cache.delete(keys[i]);
  }
}

function isNextStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isOptimizedImage(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/image");
}

function isTmdbApiProxy(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/tmdb/");
}

// Immutable, content-hashed build assets: safe to serve from cache forever
// once fetched, since a changed file always gets a new URL.
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

// Transformed images rarely change for a given URL: cache-first keeps
// re-opens instant, with a background refresh so a bad cached response
// doesn't stick around forever.
async function handleImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  return fresh || Response.error();
}

// TMDB JSON responses: stale-while-revalidate so search/movie data renders
// instantly from whatever was last seen, then refreshes in the background.
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        trimCache(API_CACHE, MAX_API_ENTRIES);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  return fresh || Response.error();
}

// App navigations: always prefer the network (client components need fresh
// auth/data anyway), only falling back to the offline shell when the
// network is unreachable. Deliberately not cached, since cached HTML would
// reference JS chunk hashes from a prior deploy that may no longer exist.
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

function readSeenNotifications() {
  try {
    if (!self[SEEN_NOTIFICATION_KEY]) {
      self[SEEN_NOTIFICATION_KEY] = {};
    }
    return self[SEEN_NOTIFICATION_KEY];
  } catch {
    return {};
  }
}

function writeSeenNotifications(nextMap) {
  self[SEEN_NOTIFICATION_KEY] = nextMap;
}

function getDedupKey(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};
  return (
    (data.notificationId && String(data.notificationId).trim()) ||
    (data.tag && String(data.tag).trim()) ||
    (notification.tag && String(notification.tag).trim()) ||
    (data.url && String(data.url).trim()) ||
    `${data.title || notification.title || ""}:${data.body || notification.body || ""}`
  );
}

function shouldShowNotification(dedupKey) {
  const now = Date.now();
  const seen = readSeenNotifications();
  const nextSeen = {};

  for (const [key, timestamp] of Object.entries(seen)) {
    if (now - timestamp <= SEEN_NOTIFICATION_TTL_MS) {
      nextSeen[key] = timestamp;
    }
  }

  if (nextSeen[dedupKey]) {
    writeSeenNotifications(nextSeen);
    return false;
  }

  nextSeen[dedupKey] = now;
  writeSeenNotifications(nextSeen);
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.add(OFFLINE_URL);
      } catch (error) {
        console.warn("Offline shell precache failed:", error);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const existingCaches = await caches.keys();
      await Promise.all(
        existingCaches
          .filter((name) => name.startsWith("canisterr-") && !CURRENT_CACHES.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isNextStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  if (isOptimizedImage(url)) {
    event.respondWith(handleImage(request));
    return;
  }

  if (isTmdbApiProxy(url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Everything else (Firebase, analytics, auth, other API routes) is left
  // untouched so the browser handles it normally.
});

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = data.title || notification.title || "Canisterr";
  const body = data.body || notification.body || "";
  const url = data.url || data.link || "/notifications";
  const dedupKey = getDedupKey(payload);

  if (!shouldShowNotification(dedupKey)) {
    return;
  }

  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || data.notificationId || dedupKey,
    renotify: false,
    data: { url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/notifications";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client && client.url.includes(url)) {
          await client.focus();
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
