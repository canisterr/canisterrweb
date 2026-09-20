export const DNA_GROUP_WEIGHTS = {
  keywords: 0.35,
  genres: 0.25,
  director: 0.15,
  cast: 0.1,
  writer: 0.05,
  decade: 0.05,
  runtime: 0.05,
} as const;

export const DNA_RATING_WEIGHTS = {
  bad: -1,
  average: 0.15,
  good: 0.6,
  masterpiece: 1,
} as const;

export const DNA_TARGET_LOGS = 25;
export const DNA_RECENCY_HALF_LIFE_MONTHS = 18;

export type DnaFeatureGroup = keyof typeof DNA_GROUP_WEIGHTS;
export type DnaRating = 0 | 1 | 1.5 | 2 | null | undefined;

export interface TitleFeatureRecord {
  titleId: string;
  type: "movie" | "series";
  genres?: string[];
  keywords?: string[];
  director?: string | null;
  writer?: string | null;
  cast?: string[];
  decade?: string | null;
  runtimeBucket?: "short" | "standard" | "long" | "epic" | null;
  language?: string | null;
  country?: string | null;
}

export interface DnaLogInput {
  title: TitleFeatureRecord;
  rating: DnaRating;
  loggedAt: string | number;
}

export function contentToTitleFeatures(content: Record<string, unknown>, contentId: string | number, contentType: "movie" | "tv"): TitleFeatureRecord {
  const releaseDate = typeof content.release_date === "string" ? content.release_date : typeof content.premiered === "string" ? content.premiered : "";
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
  const runtime = typeof content.runtime === "number" ? content.runtime : 0;

  return {
    titleId: `${contentType}-${contentId}`,
    type: contentType === "tv" ? "series" : "movie",
    genres: Array.isArray(content.genres) ? content.genres.filter((value): value is string => typeof value === "string") : [],
    keywords: Array.isArray(content.keywords) ? content.keywords.filter((value): value is string => typeof value === "string") : [],
    director: typeof content.director === "string" ? content.director : null,
    writer: typeof content.writer === "string" ? content.writer : null,
    cast: Array.isArray(content.actors) ? content.actors.filter((value): value is string => typeof value === "string") : [],
    decade: year > 0 ? `${Math.floor(year / 10) * 10}s` : null,
    runtimeBucket: runtime < 90 ? "short" : runtime < 120 ? "standard" : runtime < 160 ? "long" : runtime > 0 ? "epic" : null,
    language: typeof content.language === "string" ? content.language : null,
    country: typeof content.country === "string" ? content.country : null,
  };
}

export function topDnaFeatures(dna: MovieDna, group: DnaFeatureGroup, limit = 5): Array<{ feature: string; score: number }> {
  return Object.entries(dna.groups[group])
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([feature, score]) => ({ feature, score }));
}

export type DnaVector = Record<string, number>;

export interface MovieDna {
  groups: Record<DnaFeatureGroup, DnaVector>;
  vector: DnaVector;
  confidence: number;
  logCount: number;
  updatedAt: string;
}

export interface TasteMatchResult {
  overallScore: number;
  subScores: Record<Extract<DnaFeatureGroup, "genres" | "keywords" | "director" | "cast" | "decade">, number>;
  confidence: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map(normalize).filter(Boolean)));
}

function timestamp(value: string | number): number {
  if (typeof value === "number") {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function ratingWeight(rating: DnaRating): number {
  if (rating === 0) return DNA_RATING_WEIGHTS.bad;
  if (rating === 1.5) return DNA_RATING_WEIGHTS.average;
  if (rating === 1) return DNA_RATING_WEIGHTS.good;
  if (rating === 2) return DNA_RATING_WEIGHTS.masterpiece;
  return DNA_RATING_WEIGHTS.average;
}

function recencyWeight(loggedAt: string | number, now: number): number {
  const ageMonths = Math.max(0, (now - timestamp(loggedAt)) / (365.25 / 12 * 86400000));
  return Math.exp((-Math.log(2) * ageMonths) / DNA_RECENCY_HALF_LIFE_MONTHS);
}

function addFeature(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) || 0) + value);
}

function featureValues(title: TitleFeatureRecord, group: DnaFeatureGroup): string[] {
  switch (group) {
    case "genres":
      return unique(title.genres);
    case "keywords":
      return unique(title.keywords);
    case "director":
      return title.director ? [normalize(title.director)] : [];
    case "writer":
      return title.writer ? [normalize(title.writer)] : [];
    case "cast":
      return unique(title.cast).slice(0, 5);
    case "decade":
      return title.decade ? [normalize(title.decade)] : [];
    case "runtime":
      return title.runtimeBucket ? [normalize(title.runtimeBucket)] : [];
  }
}

function buildGroupVector(logs: DnaLogInput[], group: DnaFeatureGroup, now: number): DnaVector {
  const rawCounts = new Map<string, number>();
  logs.forEach((log) => {
    featureValues(log.title, group).forEach((feature) => {
      rawCounts.set(feature, (rawCounts.get(feature) || 0) + 1);
    });
  });

  const values = new Map<string, number>();
  logs.forEach((log) => {
    const influence = ratingWeight(log.rating) * recencyWeight(log.loggedAt, now);
    featureValues(log.title, group).forEach((feature) => {
      const dampening = Math.log1p(rawCounts.get(feature) || 1);
      addFeature(values, feature, (influence / dampening) / Math.sqrt(Math.max(1, featureValues(log.title, group).length)));
    });
  });

  return Object.fromEntries(values);
}

function mergeGroups(groups: Record<DnaFeatureGroup, DnaVector>): DnaVector {
  const vector: DnaVector = {};
  Object.entries(groups).forEach(([group, values]) => {
    const groupWeight = DNA_GROUP_WEIGHTS[group as DnaFeatureGroup];
    Object.entries(values).forEach(([feature, value]) => {
      vector[`${group}:${feature}`] = value * groupWeight;
    });
  });
  return vector;
}

export function computeMovieDna(logs: DnaLogInput[], now = Date.now()): MovieDna {
  const groups = Object.keys(DNA_GROUP_WEIGHTS).reduce((result, group) => {
    result[group as DnaFeatureGroup] = buildGroupVector(logs, group as DnaFeatureGroup, now);
    return result;
  }, {} as Record<DnaFeatureGroup, DnaVector>);

  return {
    groups,
    vector: mergeGroups(groups),
    confidence: Math.min(1, Math.log1p(logs.length) / Math.log1p(DNA_TARGET_LOGS)),
    logCount: logs.length,
    updatedAt: new Date(now).toISOString(),
  };
}

export function blendColdStartDna(personal: MovieDna, prior: MovieDna): MovieDna {
  const alpha = Math.min(1, personal.logCount / DNA_TARGET_LOGS);
  const groups = Object.keys(DNA_GROUP_WEIGHTS).reduce((result, group) => {
    const key = group as DnaFeatureGroup;
    const features = new Set([...Object.keys(personal.groups[key]), ...Object.keys(prior.groups[key])]);
    result[key] = Object.fromEntries(
      Array.from(features).map((feature) => [
        feature,
        (personal.groups[key][feature] || 0) * alpha + (prior.groups[key][feature] || 0) * (1 - alpha),
      ])
    );
    return result;
  }, {} as Record<DnaFeatureGroup, DnaVector>);

  return {
    groups,
    vector: mergeGroups(groups),
    confidence: personal.confidence,
    logCount: personal.logCount,
    updatedAt: personal.updatedAt,
  };
}

export function cosineSimilarity(left: DnaVector, right: DnaVector): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  keys.forEach((key) => {
    const leftValue = left[key] || 0;
    const rightValue = right[key] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  });
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function calculateTasteMatch(left: MovieDna, right: MovieDna): TasteMatchResult {
  const groups = ["genres", "keywords", "director", "cast", "decade"] as const;
  const subScores = Object.fromEntries(
    groups.map((group) => [group, Math.max(-1, Math.min(1, cosineSimilarity(left.groups[group], right.groups[group])))])
  ) as TasteMatchResult["subScores"];
  const weightedScore = groups.reduce((sum, group) => sum + subScores[group] * DNA_GROUP_WEIGHTS[group], 0);
  const confidence = Math.min(left.confidence, right.confidence);

  return {
    overallScore: weightedScore * confidence,
    subScores,
    confidence,
  };
}