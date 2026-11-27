"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsentChoice } from "@/lib/analytics-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = "G-N81XQ4GZ9S";

function loadAnalytics(): void {
  // Firebase action links contain one-time credentials. Never initialize analytics here.
  if (window.location.pathname === "/auth/action") return;
  if (document.querySelector('script[data-canisterr-analytics="true"]')) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
  window.gtag("js", new Date());
  window.gtag("consent", "default", { analytics_storage: "denied" });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
  const script = document.createElement("script");
  script.async = true;
  script.dataset.canisterrAnalytics = "true";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function disableAnalytics(): void {
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name?.startsWith("_ga")) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax`;
    }
  });
}

function applyChoice(choice: AnalyticsConsentChoice): void {
  setAnalyticsConsent(choice);
  if (choice === "accepted") {
    loadAnalytics();
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
    return;
  }
  disableAnalytics();
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsentChoice | null | undefined>(undefined);

  useEffect(() => {
    if (pathname === "/auth/action") return;
    const syncChoice = () => {
      const current = getAnalyticsConsent();
      setChoice(current);
      if (current === "accepted") loadAnalytics();
      if (current === "rejected") disableAnalytics();
    };
    syncChoice();
    window.addEventListener("canisterr-analytics-consent-change", syncChoice);
    window.addEventListener("storage", syncChoice);
    return () => {
      window.removeEventListener("canisterr-analytics-consent-change", syncChoice);
      window.removeEventListener("storage", syncChoice);
    };
  }, [pathname]);

  if (pathname === "/auth/action" || choice === undefined || choice) return null;

  return (
    <aside aria-label="Analytics preferences" className="fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-3xl flex-col gap-4 border border-white/15 bg-[#101010] p-4 text-[#f5f0de] shadow-[0_18px_60px_rgba(0,0,0,0.7)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="max-w-xl text-sm leading-6 text-white/70">
        Canisterr uses optional analytics to understand site usage. They stay off unless you allow them. See our <Link href="/privacy" className="font-semibold text-[#ffb36b] underline underline-offset-2">Privacy Policy</Link> or change this choice later in Privacy settings.
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={() => applyChoice("rejected")} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white/75 hover:bg-white/5">Reject</button>
        <button type="button" onClick={() => applyChoice("accepted")} className="rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold text-black hover:bg-[#ff9142]">Allow analytics</button>
      </div>
    </aside>
  );
}
