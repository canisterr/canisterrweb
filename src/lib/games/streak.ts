import type { Database } from "firebase-admin/database";

export type GameStreakKind = "reveal" | "connection" | "grid";
export type GameStreak = { current: number; best: number; lastPlayedDate: string };

export function previousGameDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
}

export function activeGameStreak(streak: GameStreak | null | undefined, today: string): number {
  if (!streak?.lastPlayedDate) return 0;
  return streak.lastPlayedDate === today || streak.lastPlayedDate === previousGameDate(today)
    ? Math.max(0, Number(streak.current) || 0)
    : 0;
}

export async function recordGameStreak(db: Database, ownerKey: string, kind: GameStreakKind, date: string): Promise<number> {
  const result = await db.ref(`games/streaks/${ownerKey}/${kind}`).transaction((current: GameStreak | null) => {
    if (current?.lastPlayedDate === date) return current;
    const currentCount = current?.lastPlayedDate === previousGameDate(date)
      ? (Math.max(0, Number(current.current) || 0) + 1)
      : 1;
    return {
      current: currentCount,
      best: Math.max(Number(current?.best) || 0, currentCount),
      lastPlayedDate: date,
    };
  });
  return Math.max(0, Number((result.snapshot.val() as GameStreak | null)?.current) || 0);
}
