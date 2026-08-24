import { fetchTmdb } from "@/lib/tmdb-transport";
import type { WatchProvider } from "./discoveryTypes";

const PREFERRED_PROVIDER_NAMES = [
  "Netflix",
  "Amazon Prime Video",
  "JioHotstar",
  "Hotstar",
  "Apple TV Plus",
  "Sony Liv",
  "Zee5",
  "MUBI",
];

const FALLBACK_PROVIDERS: WatchProvider[] = [
  { id: 8, name: "Netflix", logoPath: null },
  { id: 119, name: "Prime Video", logoPath: null },
  { id: 122, name: "JioHotstar", logoPath: null },
  { id: 350, name: "Apple TV+", logoPath: null },
  { id: 237, name: "Sony LIV", logoPath: null },
  { id: 232, name: "Zee5", logoPath: null },
  { id: 11, name: "MUBI", logoPath: null },
];

type ProviderResponse = {
  results?: Array<{
    provider_id: number;
    provider_name: string;
    logo_path?: string | null;
    display_priority?: number;
  }>;
};

export function getDefaultWatchRegion(): string {
  if (typeof window === "undefined") return "IN";
  const locale = navigator.language || "";
  if (locale.toUpperCase().endsWith("-IN") || Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata") {
    return "IN";
  }
  return "US";
}

export function providerLogoUrl(path: string | null | undefined): string | null {
  return path ? `https://image.tmdb.org/t/p/w92${path}` : null;
}

function normalizeProviderName(name: string) {
  if (name === "Amazon Prime Video") return "Prime Video";
  if (name === "Apple TV Plus") return "Apple TV+";
  if (name === "Hotstar") return "JioHotstar";
  if (name === "Sony Liv") return "Sony LIV";
  return name;
}

export async function getWatchProviders(region: string): Promise<WatchProvider[]> {
  try {
    const response = await fetchTmdb("watch/providers/movie", {
      watch_region: region,
    });
    if (!response.ok) return FALLBACK_PROVIDERS;

    const data = (await response.json()) as ProviderResponse;
    const providers = (data.results || []).map((provider) => ({
      id: provider.provider_id,
      name: normalizeProviderName(provider.provider_name),
      logoPath: provider.logo_path || null,
      displayPriority: provider.display_priority,
    }));

    const preferred = providers.filter((provider) =>
      PREFERRED_PROVIDER_NAMES.includes(provider.name) || PREFERRED_PROVIDER_NAMES.includes(provider.name.replace("+", "Plus"))
    );
    const rest = providers
      .filter((provider) => !preferred.some((item) => item.id === provider.id))
      .sort((a, b) => (a.displayPriority || 999) - (b.displayPriority || 999));

    return [...preferred, ...rest].slice(0, 24);
  } catch {
    return FALLBACK_PROVIDERS;
  }
}
