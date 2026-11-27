export type HonoursCategory = "Universal" | "Movies" | "Television" | "Community";
export type HonoursTier = 1 | 2 | 3 | 4 | 5 | 6;

export type HonourDefinition = {
  id: string;
  name: string;
  description: string;
  category: HonoursCategory;
  tier: HonoursTier;
  metric: string;
  target: number;
};

export const HONOUR_TIERS = {
  1: { name: "Debut", minimumMembershipDays: 1, color: "#BF9974", palette: "Copper" },
  2: { name: "Rising", minimumMembershipDays: 7, color: "#B8C0C8", palette: "Silver" },
  3: { name: "Enthusiast", minimumMembershipDays: 30, color: "#A9B99B", palette: "Sage" },
  4: { name: "Cinephile", minimumMembershipDays: 90, color: "#9BAABD", palette: "Steel Blue" },
  5: { name: "Prestige", minimumMembershipDays: 365, color: "#D7BC79", palette: "Antique Gold" },
  6: { name: "Legacy", minimumMembershipDays: 1095, color: "#D9B5BF", palette: "Vintage Burgundy" },
} as const;

const definitions: HonourDefinition[] = [
  ["01", "First Frame", "Log your first movie.", "Movies", 1, "uniqueMovies", 1],
  ["02", "Pilot", "Log your first TV episode.", "Television", 1, "uniqueEpisodes", 1],
  ["03", "The Verdict", "Submit your first rating.", "Universal", 1, "ratedTitles", 1],
  ["04", "First Masterpiece", "Rate any title Masterpiece.", "Universal", 1, "masterpieceTitles", 1],
  ["05", "Double Feature", "Watch two different movies in one day.", "Movies", 1, "doubleFeatureDays", 1],
  ["06", "Next Episode", "Watch three episodes of a show.", "Television", 1, "maxEpisodesInSeries", 3],
  ["07", "The Critic", "Publish your first review.", "Community", 1, "reviews", 1],
  ["08", "The Collector", "Add 10 titles to your watchlist.", "Universal", 1, "watchlistTitles", 10],
  ["09", "Opening Credits", "Complete your profile.", "Community", 1, "profileComplete", 1],
  ["10", "The Connection", "Follow your first user.", "Community", 1, "following", 1],
  ["11", "The First Reel", "Log 10 unique movies.", "Movies", 2, "uniqueMovies", 10],
  ["12", "Season Finale", "Complete your first TV season.", "Television", 2, "completedSeasons", 1],
  ["13", "Genre Hopper", "Explore 5 different genres.", "Universal", 2, "genres", 5],
  ["14", "Second Time Around", "Rewatch 3 movies or TV episodes.", "Universal", 2, "rewatches", 3],
  ["15", "The Storyteller", "Publish 5 reviews.", "Community", 2, "reviews", 5],
  ["16", "Lost in Translation", "Explore 3 original languages.", "Universal", 2, "languages", 3],
  ["17", "The Completionist", "Complete a movie franchise containing at least 3 films.", "Movies", 2, "completedFranchises", 1],
  ["18", "Hidden Treasure", "Watch a title with fewer than 500 TMDB votes.", "Universal", 2, "lowVoteTitles", 1],
  ["19", "The Cliffhanger", "Watch 25 unique episodes.", "Television", 2, "uniqueEpisodes", 25],
  ["20", "The Ensemble", "Watch 5 different titles featuring the same actor.", "Universal", 2, "ensembleActorTitles", 5],
  ["21", "The Film Buff", "Log 30 unique movies.", "Movies", 3, "uniqueMovies", 30],
  ["22", "Small Screen Society", "Complete 5 seasons across at least 3 shows.", "Television", 3, "seasonsAcrossThreeShows", 5],
  ["23", "Century of Hours", "Accumulate 100 hours of watch time.", "Universal", 3, "watchMinutes", 6000],
  ["24", "Cinema Passport", "Explore 10 production countries.", "Universal", 3, "countries", 10],
  ["25", "The Voice", "Publish 15 reviews.", "Community", 3, "reviews", 15],
  ["26", "Retro Soul", "Watch 10 titles released before 1980.", "Universal", 3, "pre1980Titles", 10],
  ["27", "The Independent", "Watch 10 movies with reported budgets below $5 million.", "Movies", 3, "lowBudgetMovies", 10],
  ["28", "The Loyalist", "Rewatch 10 distinct movies or episodes.", "Universal", 3, "distinctRewatchedItems", 10],
  ["29", "The Series Finisher", "Complete 3 ended TV series.", "Television", 3, "completedEndedSeries", 3],
  ["30", "The Discerning Eye", "Submit 25 distinct title ratings.", "Universal", 3, "ratedTitles", 25],
  ["31", "The Centurion", "Log 100 unique movies.", "Movies", 4, "uniqueMovies", 100],
  ["32", "The Episode Centurion", "Watch 100 unique TV episodes.", "Television", 4, "uniqueEpisodes", 100],
  ["33", "The Globetrotter", "Watch 3 titles from each of 20 production countries.", "Universal", 4, "countriesWithThreeTitles", 20],
  ["34", "The Polyglot", "Watch 3 titles in each of 10 original languages.", "Universal", 4, "languagesWithThreeTitles", 10],
  ["35", "The Auteur", "Complete the released feature filmographies of 3 directors, each with at least 5 films.", "Movies", 4, "completedDirectorFilmographies", 3],
  ["36", "The Historian", "Explore 40 distinct release years.", "Universal", 4, "releaseYears", 40],
  ["37", "The Contrarian", "Submit 25 verdicts strongly opposing TMDB audience ratings.", "Universal", 4, "contrarianRatings", 25],
  ["38", "The Showrunner", "Complete 25 TV seasons across at least 10 shows.", "Television", 4, "seasonsAcrossTenShows", 25],
  ["39", "The Archivist", "Log 500 unique movies.", "Movies", 5, "uniqueMovies", 500],
  ["40", "The Odyssey", "Accumulate 1,000 hours of watch time.", "Universal", 5, "watchMinutes", 60000],
  ["41", "The Televisionist", "Watch 1,000 unique TV episodes.", "Television", 5, "uniqueEpisodes", 1000],
  ["42", "The World Citizen", "Watch 3 titles from each of 40 production countries.", "Universal", 5, "countriesWithThreeTitles", 40],
  ["43", "The Master Curator", "Publish 100 reviews across at least 12 months.", "Community", 5, "reviewsAcrossTwelveMonths", 100],
  ["44", "The Time Traveller", "Watch 10 titles from each of 10 different decades.", "Universal", 5, "decadesWithTenTitles", 10],
  ["45", "The Network Scholar", "Complete 25 TV shows across at least 10 original networks.", "Television", 5, "completedShowsAcrossTenNetworks", 25],
  ["46", "The Seasoned", "Log something every month for 24 consecutive months.", "Universal", 5, "consecutiveActiveMonths", 24],
  ["47", "The Millennium", "Log 1,000 unique movies.", "Movies", 6, "uniqueMovies", 1000],
  ["48", "The Television Legend", "Complete 100 ended TV series.", "Television", 6, "completedEndedSeries", 100],
  ["49", "The Encyclopaedia", "Explore 75 production countries, 30 original languages and 10 release decades.", "Universal", 6, "encyclopaediaMilestones", 1],
  ["50", "The Immortal", "Complete 5 years on Canisterr with at least 50 movies or 100 episodes, or an equivalent combination, logged each membership year.", "Universal", 6, "immortalMembershipYears", 5],
].map(([id, name, description, category, tier, metric, target]) => ({
  id: String(id), name: String(name), description: String(description), category: category as HonoursCategory,
  tier: tier as HonoursTier, metric: String(metric), target: Number(target),
}));

export const HONOUR_DEFINITIONS = definitions;
export const HONOUR_DEFINITION_BY_ID = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));

export type HonourProgress = {
  id: string;
  name: string;
  description: string;
  category: HonoursCategory;
  tier: HonoursTier;
  tierName: string;
  tierColor: string;
  current: number;
  target: number;
  unlocked: boolean;
  eligible: boolean;
  eligibilityDate: string;
  progress: number;
};

export function evaluateHonours(metrics: Record<string, number>, membershipDate: string, now = new Date()): HonourProgress[] {
  const joinedAt = Date.parse(membershipDate);
  return definitions.map((definition) => {
    const tier = HONOUR_TIERS[definition.tier];
    const eligibilityDate = Number.isFinite(joinedAt)
      ? new Date(joinedAt + tier.minimumMembershipDays * 86_400_000).toISOString()
      : "";
    const current = Math.max(0, Number(metrics[definition.metric] || 0));
    const metricMet = current >= definition.target;
    const eligible = Boolean(eligibilityDate && Date.parse(eligibilityDate) <= now.getTime());
    const unlocked = eligible && metricMet;
    return {
      ...definition,
      tierName: tier.name,
      tierColor: tier.color,
      current: Math.min(current, definition.target),
      unlocked,
      eligible,
      eligibilityDate,
      progress: definition.target > 0 ? Math.min(100, Math.round((current / definition.target) * 100)) : 0,
    };
  });
}

export function getRarity(unlockedCount: number, eligibleCount: number): number {
  if (eligibleCount <= 0) return 0;
  return Math.round((unlockedCount / eligibleCount) * 1000) / 10;
}
