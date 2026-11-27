export type RatingCounts = {
  bad: number;
  average: number;
  good: number;
  masterpiece: number;
};

export type DivideClassification = "United" | "Mixed" | "Divisive" | "Polarizing";

export type DivideScore = {
  score: number;
  classification: DivideClassification;
  ratingCount: number;
};

export const MIN_DIVIDE_RATINGS = 1;

export function calculateDivideScore(counts: RatingCounts): DivideScore | null {
  const votes = [counts.bad, counts.average, counts.good, counts.masterpiece];
  const ratingCount = votes.reduce((total, count) => total + count, 0);
  if (ratingCount < MIN_DIVIDE_RATINGS) return null;

  const mean = votes.reduce((total, count, value) => total + count * value, 0) / ratingCount;
  const variance = votes.reduce(
    (total, count, value) => total + count * (value - mean) ** 2,
    0
  ) / ratingCount;
  const rawScore = Math.min(100, (Math.sqrt(variance) / 1.5) * 100);
  const score = Math.round(rawScore * 10) / 10;

  const classification: DivideClassification = rawScore <= 25
    ? "United"
    : rawScore <= 50
      ? "Mixed"
      : rawScore <= 75
        ? "Divisive"
        : "Polarizing";

  return { score, classification, ratingCount };
}
