"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AutoPushPrompt = dynamic(() => import("./AutoPushPrompt"), { ssr: false });
const ForegroundPushListener = dynamic(() => import("./ForegroundPushListener"), { ssr: false });

export default function DeferredPushEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The localhost cleanup removes service workers. Auto-enrolling for push here
    // would register one again and trigger a full-page reload loop.
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return;

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => windowWithIdle.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(() => setReady(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <>
      <AutoPushPrompt />
      <ForegroundPushListener />
    </>
  );
}
