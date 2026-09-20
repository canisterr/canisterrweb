import {
  calculateTasteMatch,
  computeMovieDna,
  type DnaLogInput,
} from "./movie-dna";

const now = Date.now();
const logsA: DnaLogInput[] = [
  {
    title: {
      titleId: "movie-a",
      type: "movie",
      genres: ["Drama"],
      keywords: ["heist", "betrayal"],
      director: "Director A",
      cast: ["Actor A"],
      decade: "2020s",
      runtimeBucket: "standard",
    },
    rating: 2,
    loggedAt: now,
  },
];

const logsB: DnaLogInput[] = [
  {
    ...logsA[0],
    title: { ...logsA[0].title, titleId: "movie-b" },
    rating: 1,
  },
];

const dnaA = computeMovieDna(logsA, now);
const dnaB = computeMovieDna(logsB, now);
const match = calculateTasteMatch(dnaA, dnaB);

if (dnaA.confidence <= 0 || match.subScores.genres <= 0 || match.overallScore <= 0) {
  throw new Error("Movie DNA smoke test failed");
}

console.log("Movie DNA smoke test passed");