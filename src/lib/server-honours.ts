import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { calculateHonourMetrics, type HonourMetadata } from "@/lib/honours-calculator";
import { evaluateHonours, HONOUR_DEFINITIONS, HONOUR_TIERS, type HonourProgress } from "@/lib/honours-engine";
import type { MovieLog, User } from "@/types";

type PersistedHonour = HonourProgress & { unlockedAt?: string | null };

function normalizedLogs(snapshot: { val: () => unknown }): MovieLog[] {
  const raw = snapshot.val();
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, Record<string, unknown>>).map(([id, value]) => ({ ...value, id } as MovieLog));
}

async function refreshEligibleUserCounts(now: Date) {
  const db = getFirebaseAdminDatabase();
  const lastUpdatedSnapshot = await db.ref("honour_stats/meta/eligibilityUpdatedAt").get();
  const lastUpdatedAt = Date.parse(String(lastUpdatedSnapshot.val() || ""));
  if (Number.isFinite(lastUpdatedAt) && now.getTime() - lastUpdatedAt < 6 * 60 * 60 * 1000) return;
  // Read the small user directory once instead of relying on a deployed RTDB
  // .indexOn rule for created_at. Membership eligibility is filtered below.
  const usersSnapshot = await db.ref("users").get();
  const countsByTier = new Map<number, number>(Object.keys(HONOUR_TIERS).map((tier) => [Number(tier), 0]));
  const users = usersSnapshot.val() as Record<string, { created_at?: string; createdAt?: string }> | null;
  for (const profile of Object.values(users || {})) {
    const createdAt = Date.parse(profile.created_at || profile.createdAt || "");
    if (!Number.isFinite(createdAt) || createdAt > now.getTime()) continue;
    for (const [tierKey, tier] of Object.entries(HONOUR_TIERS)) {
      if (now.getTime() - createdAt >= tier.minimumMembershipDays * 86_400_000) {
        const tierId = Number(tierKey);
        countsByTier.set(tierId, (countsByTier.get(tierId) || 0) + 1);
      }
    }
  }
  const updates: Record<string, number | string> = {};
  for (const definition of HONOUR_DEFINITIONS) updates[`honour_stats/${definition.id}/eligibleCount`] = countsByTier.get(definition.tier) || 0;
  updates["honour_stats/meta/eligibilityUpdatedAt"] = now.toISOString();
  await db.ref().update(updates);
}

function definitionRecords() {
  return Object.fromEntries(HONOUR_DEFINITIONS.map((definition) => [definition.id, {
    ...definition,
    tierDetails: HONOUR_TIERS[definition.tier],
  }]));
}

export async function recalculateHonoursForUser(userId: string) {
  const db = getFirebaseAdminDatabase();
  const [userSnapshot, logsSnapshot, followsSnapshot, metadataSnapshot, existingSnapshot] = await Promise.all([
    db.ref(`users/${userId}`).get(),
    db.ref("movie_logs").orderByChild("user_id").equalTo(userId).get(),
    db.ref("follows").orderByChild("follower_id").equalTo(userId).get(),
    db.ref(`watched_movies_meta/${userId}/story_details`).get(),
    db.ref(`honours/${userId}`).get(),
  ]);
  if (!userSnapshot.exists()) throw new Error("Profile not found");
  const rawUser = userSnapshot.val() as Record<string, unknown>;
  const user = {
    ...rawUser,
    id: userId,
    created_at: String(rawUser.created_at || rawUser.createdAt || ""),
    name: String(rawUser.name || ""),
    username: String(rawUser.username || ""),
    avatar_url: typeof rawUser.avatar_url === "string" ? rawUser.avatar_url : null,
    bio: typeof rawUser.bio === "string" ? rawUser.bio : "",
  } as User;
  const logs = normalizedLogs(logsSnapshot);
  const storyDetails = (metadataSnapshot.val() || {}) as Record<string, HonourMetadata>;
  const metadataByMediaKey: Record<string, HonourMetadata | null> = {};
  for (const [key, value] of Object.entries(storyDetails)) {
    const separator = key.lastIndexOf("_");
    if (separator < 0) continue;
    const mediaType = key.slice(0, separator);
    const mediaId = key.slice(separator + 1);
    if ((mediaType === "movie" || mediaType === "tv") && /^\d+$/.test(mediaId)) {
      metadataByMediaKey[`${mediaType}:${mediaId}`] = value;
    }
  }
  const following = followsSnapshot.val() as Record<string, { status?: string }> | null;
  const followingCount = Object.values(following || {}).filter((follow) => follow.status === "accepted").length;
  const metrics = calculateHonourMetrics({ user, logs, metadataByMediaKey, followingCount });
  const calculated = evaluateHonours(metrics, user.created_at);
  const existing = (existingSnapshot.val() || {}) as { achievements?: Record<string, PersistedHonour>; pins?: string[] };
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const nextAchievements: Record<string, PersistedHonour> = {};
  const newlyUnlocked: HonourProgress[] = [];

  await db.ref("honour_definitions").transaction((current) => current || definitionRecords());
  await refreshEligibleUserCounts(nowDate);
  await Promise.all(calculated.map(async (item) => {
    const entryRef = db.ref(`honours/${userId}/achievements/${item.id}`);
    let wasNewUnlock = false;
    const result = await entryRef.transaction((current: PersistedHonour | null) => {
      const previouslyUnlocked = Boolean(current?.unlocked || current?.unlockedAt);
      const unlocked = previouslyUnlocked || item.unlocked;
      wasNewUnlock = !previouslyUnlocked && item.unlocked;
      return {
        ...item,
        unlocked,
        unlockedAt: current?.unlockedAt || (wasNewUnlock ? now : null),
      };
    });
    const persisted = result.snapshot.val() as PersistedHonour;
    nextAchievements[item.id] = persisted;
    if (wasNewUnlock && result.committed) {
      newlyUnlocked.push(item);
      await db.ref(`notifications/${userId}/honour-${item.id}`).transaction((current) => current || {
        type: "honour_unlocked",
        title: `Honour unlocked: ${item.name}`,
        body: item.description,
        fromUser: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatar_url: user.avatar_url || null,
        },
        url: `/profile/${encodeURIComponent(user.username)}?tab=honours`,
        createdAt: now,
        seen: false,
      });
    }
  }));

  for (const item of Object.values(nextAchievements)) {
    if (item.unlocked) {
      const markerRef = db.ref(`honour_unlocks/${item.id}/${userId}`);
      let createdMarker = false;
      const marker = await markerRef.transaction((current) => {
        if (current) return current;
        createdMarker = true;
        return true;
      });
      if (marker.committed && createdMarker) {
        await db.ref(`honour_stats/${item.id}/unlockedCount`).transaction((current) => (Number(current) || 0) + 1);
      }
    }
  }

  const rarity: Record<string, number> = {};
  const honourStatsSnapshot = await db.ref("honour_stats").get();
  const honourStats = (honourStatsSnapshot.val() || {}) as Record<string, { eligibleCount?: number }>;
  for (const { id } of HONOUR_DEFINITIONS) {
    const eligible = Number(honourStats[id]?.eligibleCount || 0);
    const unlocked = Number((honourStats[id] as { unlockedCount?: number } | undefined)?.unlockedCount || 0);
    rarity[id] = eligible ? Math.min(100, Math.round(unlocked / eligible * 1000) / 10) : 0;
  }
  await db.ref(`honours/${userId}`).update({
    rarity,
    metrics,
    updatedAt: now,
  });
  return { achievements: nextAchievements, pins: existing.pins || [], rarity, metrics, newlyUnlocked: newlyUnlocked.map(({ id }) => id) };
}

export async function getHonoursForUser(userId: string) {
  const db = getFirebaseAdminDatabase();
  const snapshot = await db.ref(`honours/${userId}`).get();
  return snapshot.val() || null;
}
