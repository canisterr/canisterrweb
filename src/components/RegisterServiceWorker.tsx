"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    };

    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(register, { timeout: 2000 });
      return () => windowWithIdle.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(register, 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
