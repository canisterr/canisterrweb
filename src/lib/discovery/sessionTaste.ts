import type { DiscoveryMovie, DiscoverySwipe, SessionTaste } from "./discoveryTypes";

export function createSessionTaste(): SessionTaste {
  return {
    likedGenres: {},
    dislikedGenres: {},
    likedKeywords: {},
    dislikedKeywords: {},
    longRuntimePasses: 0,
    totalSwipes: 0,
  };
}

function bump(record: Record<number, number>, ids: number[] | undefined, amount: number) {
  (ids || []).forEach((id) => {
    record[id] = (record[id] || 0) + amount;
  });
}

export function applySwipeToTaste(taste: SessionTaste, swipe: DiscoverySwipe): SessionTaste {
  const next: SessionTaste = {
    likedGenres: { ...taste.likedGenres },
    dislikedGenres: { ...taste.dislikedGenres },
    likedKeywords: { ...taste.likedKeywords },
    dislikedKeywords: { ...taste.dislikedKeywords },
    longRuntimePasses: taste.longRuntimePasses,
    totalSwipes: taste.totalSwipes + 1,
  };

  if (swipe.action === "pass") {
    bump(next.dislikedGenres, swipe.genres, 1);
    bump(next.dislikedKeywords, swipe.keywordIds, 0.75);
    if ((swipe.runtime || 0) >= 150) next.longRuntimePasses += 1;
  } else {
    bump(next.likedGenres, swipe.genres, swipe.action === "watchlist" ? 1.1 : 1);
    bump(next.likedKeywords, swipe.keywordIds, swipe.action === "watchlist" ? 0.9 : 0.75);
  }

  return next;
}

export function getSessionTasteScore(movie: DiscoveryMovie, taste: SessionTaste): number {
  if (taste.totalSwipes < 3) return 0;

  const genreIds = movie.genre_ids || movie.genres || [];
  const keywordIds = movie.keywordIds || [];

  let score = 0;
  genreIds.forEach((genreId) => {
    score += (taste.likedGenres[genreId] || 0) * 18;
    score -= (taste.dislikedGenres[genreId] || 0) * 12;
  });
  keywordIds.forEach((keywordId) => {
    score += (taste.likedKeywords[keywordId] || 0) * 6;
    score -= (taste.dislikedKeywords[keywordId] || 0) * 4;
  });

  if (taste.longRuntimePasses >= 2 && (movie.runtime || 0) > 150) {
    score -= 35;
  }

  return score;
}

export function getDiscoveryInsight(taste: SessionTaste): string | null {
  if (taste.totalSwipes < 5) return null;
  if (taste.longRuntimePasses >= 2) return "Keeping it under 2 hours?";
  return null;
}
