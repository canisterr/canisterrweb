import { get, ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export interface MatchScorePoint {
  date: string; // YYYY-MM-DD
  score: number;
}

function getPairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join("_");
}

/**
 * Record today's match score for this pair. The date is the storage key, so
 * repeat views on the same day overwrite rather than pile up duplicate
 * points — this naturally caps writes to once per day per pair.
 */
export async function recordMatchScorePoint(
  userAId: string,
  userBId: string,
  score: number
): Promise<void> {
  if (userAId === userBId) return;
  const pairKey = getPairKey(userAId, userBId);
  const dateKey = new Date().toISOString().slice(0, 10);

  try {
    await set(ref(db, `match_history/${pairKey}/${dateKey}`), score);
  } catch (error) {
    console.error("recordMatchScorePoint: failed to write", pairKey, error);
  }
}

/**
 * Score history for this pair, oldest first, capped to the most recent 30
 * points so the trend sparkline stays readable.
 */
export async function getMatchScoreHistory(
  userAId: string,
  userBId: string
): Promise<MatchScorePoint[]> {
  if (userAId === userBId) return [];
  const pairKey = getPairKey(userAId, userBId);

  try {
    const snapshot = await get(ref(db, `match_history/${pairKey}`));
    if (!snapshot.exists()) return [];

    const raw = snapshot.val() as Record<string, number>;
    return Object.entries(raw)
      .map(([date, score]) => ({ date, score }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  } catch (error) {
    console.error("getMatchScoreHistory: failed to read", pairKey, error);
    return [];
  }
}
