import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { fetchTmdb } from "@/lib/tmdb-transport";
import type { GameTitle } from "./types";

export async function ensureProductionCompanies(title: GameTitle): Promise<GameTitle> {
  if (Array.isArray(title.productionCompanies)) return title;
  try {
    const response = await fetchTmdb(`movie/${title.tmdbId}`);
    if (!response.ok) return { ...title, productionCompanies: [] };
    const details = await response.json() as { production_companies?: Array<{ name?: string }> };
    const productionCompanies = [...new Set((details.production_companies || [])
      .map((company) => company.name?.trim() || "")
      .filter(Boolean))];
    const updated = { ...title, productionCompanies, updatedAt: Date.now() };
    await getFirebaseAdminDatabase().ref(`games/catalogue/${title.key}`).update({ productionCompanies, updatedAt: updated.updatedAt });
    return updated;
  } catch {
    return { ...title, productionCompanies: [] };
  }
}
