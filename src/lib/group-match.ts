import { calculateMatchScore } from "@/lib/match-score";
import { buildTasteProfileForScoring, getTasteSignature, type MatchTaste } from "@/lib/taste-signature";
import { getUsersByIds, normalizeUserRecord } from "@/lib/users";

export interface GroupMember {
  userId: string;
  username: string;
  name: string;
  avatar_url: string | null;
}

export interface GroupMovie {
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
}

export interface GroupRecommendation extends GroupMovie {
  votedBy: number;
}

export interface GroupMatchResult {
  members: GroupMember[];
  groupScore: number;
  topGenres: string[];
  topCreators: string[];
  avgYear: number;
  commonMovies: GroupMovie[];
  groupRecommendations: GroupRecommendation[];
}

function contentKey(taste: MatchTaste): string {
  return `${taste.content_type}-${taste.content_id}`;
}

function toGroupMovie(taste: MatchTaste): GroupMovie {
  const content = taste.content as any;
  return {
    id: taste.content_id,
    title: content?.title || content?.name || "Unknown",
    poster_url: content?.poster_url || null,
    type: (taste.content_type as "movie" | "tv") || "movie",
  };
}

/**
 * Compatibility + shared taste for 3+ people at once, built on the same
 * cached taste_signatures used for 1:1 matching (Phase 1) — so group score
 * is a plain average of pairwise scores rather than a new algorithm.
 */
export async function generateGroupMatch(userIds: string[]): Promise<GroupMatchResult> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length < 2) {
    throw new Error("Group match needs at least 2 people");
  }

  const [profiles, signatures, tastesByUser] = await Promise.all([
    getUsersByIds(uniqueIds),
    Promise.all(uniqueIds.map((id) => getTasteSignature(id))),
    Promise.all(uniqueIds.map((id) => buildTasteProfileForScoring(id))),
  ]);

  const members: GroupMember[] = uniqueIds
    .map((id) => {
      const raw = profiles[id];
      if (!raw) return null;
      const normalized = normalizeUserRecord(id, raw);
      return {
        userId: id,
        username: normalized.username,
        name: normalized.name,
        avatar_url: normalized.avatar_url,
      };
    })
    .filter((member): member is GroupMember => member !== null);

  // Group score: average of every pairwise calculateMatchScore, pure math
  // over already-cached signatures.
  let pairSum = 0;
  let pairCount = 0;
  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      pairSum += calculateMatchScore(signatures[i], signatures[j]).totalScore;
      pairCount += 1;
    }
  }
  const groupScore = pairCount > 0 ? Math.round(pairSum / pairCount) : 0;

  const majority = Math.ceil(uniqueIds.length / 2);

  // Group Taste DNA: genres/creators liked by at least half the group,
  // averaged the same way GenreSim compares two people.
  const genreTotals = new Map<string, { sum: number; count: number }>();
  signatures.forEach((sig) => {
    Object.entries(sig.genreAffinities).forEach(([genre, affinity]) => {
      const entry = genreTotals.get(genre) || { sum: 0, count: 0 };
      entry.sum += affinity;
      entry.count += 1;
      genreTotals.set(genre, entry);
    });
  });
  const topGenres = Array.from(genreTotals.entries())
    .filter(([, { count }]) => count >= majority)
    .map(([genre, { sum, count }]) => ({ genre, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
    .map(({ genre }) => genre);

  const creatorCounts = new Map<string, number>();
  signatures.forEach((sig) => {
    new Set(sig.creators).forEach((creator) => {
      creatorCounts.set(creator, (creatorCounts.get(creator) || 0) + 1);
    });
  });
  const topCreators = Array.from(creatorCounts.entries())
    .filter(([, count]) => count >= majority)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([creator]) => creator.replace(/^dir:|^act:/, ""));

  const avgYear = Math.round(
    signatures.reduce((sum, sig) => sum + sig.avgYear, 0) / signatures.length
  );

  // Common movies: in every single member's taste profile.
  const idSets = signatures.map((sig) => new Set(sig.contentIds));
  const commonIds = new Set(
    Array.from(idSets[0] || []).filter((id) => idSets.every((set) => set.has(id)))
  );

  const contentIndex = new Map<string, MatchTaste>();
  tastesByUser.forEach((tastes) => {
    tastes.forEach((taste) => {
      const key = contentKey(taste);
      if (!contentIndex.has(key)) contentIndex.set(key, taste);
    });
  });

  const commonMovies = Array.from(commonIds)
    .map((key) => contentIndex.get(key))
    .filter((taste): taste is MatchTaste => Boolean(taste))
    .map(toGroupMovie);

  // Group recommendations: liked by 2+ people but not the whole group —
  // "most of you would probably be into this."
  const votes = new Map<string, { taste: MatchTaste; voters: Set<string> }>();
  tastesByUser.forEach((tastes, index) => {
    const userId = uniqueIds[index];
    tastes.forEach((taste) => {
      if (taste.reaction !== 2 && taste.reaction !== 1) return;
      const key = contentKey(taste);
      if (commonIds.has(key)) return;
      const entry = votes.get(key) || { taste, voters: new Set<string>() };
      entry.voters.add(userId);
      votes.set(key, entry);
    });
  });

  const groupRecommendations = Array.from(votes.values())
    .filter((entry) => entry.voters.size >= 2)
    .sort((a, b) => b.voters.size - a.voters.size)
    .slice(0, 10)
    .map((entry) => ({ ...toGroupMovie(entry.taste), votedBy: entry.voters.size }));

  return {
    members,
    groupScore,
    topGenres,
    topCreators,
    avgYear,
    commonMovies,
    groupRecommendations,
  };
}
