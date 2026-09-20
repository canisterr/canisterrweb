import { fetchTmdb } from "@/lib/tmdb-transport";
import type { WatchProviderOption } from "./types";

interface ProviderResponse {
  results?: Array<{ provider_id: number; provider_name: string; display_priority?: number }>;
}

const PREFERRED_NAMES = ["Netflix", "Amazon Prime Video", "JioHotstar", "Hotstar", "Apple TV Plus", "Sony Liv", "Zee5", "MUBI"];

function displayName(name: string): string {
  if (name === "Amazon Prime Video") return "Prime Video";
  if (name === "Apple TV Plus") return "Apple TV+";
  if (name === "Hotstar") return "JioHotstar";
  return name;
}

export async function getWatchProviderOptions(region: string): Promise<WatchProviderOption[]> {
  try {
    const response = await fetchTmdb("watch/providers/movie", { watch_region: region });
    if (!response.ok) return [];
    const data = (await response.json()) as ProviderResponse;
    return (data.results || [])
      .filter((provider) => PREFERRED_NAMES.includes(provider.provider_name))
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .map((provider) => ({ id: provider.provider_id, name: displayName(provider.provider_name) }))
      .filter((provider, index, all) => all.findIndex((item) => item.id === provider.id) === index)
      .slice(0, 8);
  } catch {
    return [];
  }
}
