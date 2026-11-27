"use client";

import { useEffect } from "react";

const CLEANUP_RELOAD_KEY = "canisterr_localhost_sw_cleanup_reloaded";

export default function LocalhostServiceWorkerCleanup() {
  useEffect(() => {
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!isLocalhost || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    (async () => {
      let clearedStaleData = false;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (cancelled) return;

        const removed = await Promise.all(registrations.map((registration) => registration.unregister()));
        clearedStaleData = removed.some(Boolean);
      } catch (error) {
        console.warn("Service worker cleanup failed:", error);
      }

      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          if (cancelled) return;

          if (keys.length > 0) {
            await Promise.all(keys.map((key) => caches.delete(key)));
            clearedStaleData = true;
          }
        }
      } catch (error) {
        console.warn("Cache cleanup failed:", error);
      }

      if (clearedStaleData && !cancelled) {
        try {
          if (window.sessionStorage.getItem(CLEANUP_RELOAD_KEY) === "1") return;
          window.sessionStorage.setItem(CLEANUP_RELOAD_KEY, "1");
        } catch {
          // A storage failure should never cause a reload loop.
          return;
        }
        window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
