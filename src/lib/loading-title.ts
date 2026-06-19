const PENDING_LOADING_TITLE_KEY = "canisterr:pending-loading-title";

export function setPendingLoadingTitle(title: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return;
  window.sessionStorage.setItem(PENDING_LOADING_TITLE_KEY, cleanTitle);
}

export function takePendingLoadingTitle(): string | null {
  if (typeof window === "undefined") return null;
  const title = window.sessionStorage.getItem(PENDING_LOADING_TITLE_KEY);
  window.sessionStorage.removeItem(PENDING_LOADING_TITLE_KEY);
  return title;
}
