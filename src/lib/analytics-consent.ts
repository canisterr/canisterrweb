"use client";

export const ANALYTICS_CONSENT_KEY = "canisterr:analytics-consent:v1";
export type AnalyticsConsentChoice = "accepted" | "rejected";

export function getAnalyticsConsent(): AnalyticsConsentChoice | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

export function setAnalyticsConsent(choice: AnalyticsConsentChoice): void {
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
  window.dispatchEvent(new CustomEvent("canisterr-analytics-consent-change", { detail: choice }));
}
