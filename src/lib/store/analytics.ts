type StoreEventName =
  | "store_opened"
  | "aisle_entered"
  | "movie_selected_from_store"
  | "store_search"
  | "store_map_used"
  | "store_watchlist_added"
  | "store_simple_view_opened";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fires a gtag event, reusing the GA setup already wired in src/app/layout.tsx. No new analytics provider. */
export function trackStoreEvent(name: StoreEventName, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
