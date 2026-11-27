import type { MovieLog, User } from "@/types";

export type HonourMetadata = {
  genres?: Array<string | number | { id?: number; name?: string }> | null;
  original_language?: string | null;
  language?: string | null;
  production_countries?: Array<string | { name?: string | null; iso_3166_1?: string | null }> | null;
  origin_countries?: string[] | null;
  countries?: string[] | null;
  country?: string | null;
  release_date?: string | null;
  premiered?: string | null;
  runtime?: number | null;
  episode_runtime_by_key?: Record<string, number> | null;
  vote_count?: number | null;
  vote_average?: number | null;
  rating?: number | null;
  budget?: number | null;
  actors?: string[] | null;
  cast_details?: Array<{ name?: string | null }> | null;
  director?: string | null;
  directors?: string[] | null;
  crew_details?: Array<{ name?: string | null; job?: string | null }> | null;
  collection_id?: number | null;
  belongs_to_collection?: { id?: number | null } | null;
  collection_movie_ids?: number[] | null;
  released_feature_filmography_ids?: Record<string, number[]> | null;
  regular_episode_inventory_complete?: boolean;
  status?: string | null;
  network?: { name?: string | null } | null;
  networks?: string[] | null;
  regular_episodes?: Array<{ season: number; episode: number; runtime?: number | null; released?: boolean; air_date?: string | null }> | null;
};

const mediaKey = (type: string, id: number) => `${type}:${id}`;
const episodeKey = (log: MovieLog) => `${mediaKey("tv", log.content_id)}:${log.season}:${log.episode}`;

function strings(values: unknown): string[] {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()) : [];
}

function genres(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return `genre:${value}`;
    if (value && typeof value === "object") {
      const genre = value as { id?: number; name?: string };
      return genre.name?.trim() || (typeof genre.id === "number" ? `genre:${genre.id}` : "");
    }
    return "";
  }).filter(Boolean);
}

function metadataCountries(metadata: HonourMetadata): string[] {
  const source = metadata.production_countries || metadata.countries || metadata.origin_countries || [];
  const countries = source.map((item) => typeof item === "string" ? item : item.name || item.iso_3166_1 || "").filter(Boolean);
  return [...new Set(countries)];
}

function calculateConsecutiveMonths(dates: string[]): number {
  const months = [...new Set(dates.map((date) => date.slice(0, 7)).filter((date) => /^\d{4}-\d{2}$/.test(date)))].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const month of months) {
    const current = new Date(`${month}-01T00:00:00.000Z`);
    run = previous && current.getUTCFullYear() === previous.getUTCFullYear() && current.getUTCMonth() === previous.getUTCMonth() + 1 || previous && current.getUTCFullYear() === previous.getUTCFullYear() + 1 && previous.getUTCMonth() === 11 && current.getUTCMonth() === 0 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

export function calculateHonourMetrics(args: {
  user: User;
  logs: MovieLog[];
  metadataByMediaKey: Record<string, HonourMetadata | null | undefined>;
  followingCount: number;
  watchlistLogs?: MovieLog[];
  now?: Date;
}): Record<string, number> {
  const { user, logs, metadataByMediaKey, followingCount, now = new Date() } = args;
  const watched = logs.filter((log) => !log.watch_later && Boolean(log.watched_date));
  const movies = watched.filter((log) => log.content_type === "movie");
  const tv = watched.filter((log) => log.content_type === "tv");
  const uniqueMovies = new Map(movies.map((log) => [mediaKey("movie", log.content_id), log]));
  const uniqueSeries = new Map(tv.map((log) => [mediaKey("tv", log.content_id), log]));
  const uniqueEpisodes = new Map(tv.filter((log) => Number.isInteger(log.season) && Number.isInteger(log.episode) && (log.season || 0) > 0 && (log.episode || 0) > 0)
    .map((log) => [episodeKey(log), log]));
  const uniqueTitleLogs = [...uniqueMovies.values(), ...uniqueSeries.values()];
  const metadata = (log: MovieLog) => metadataByMediaKey[mediaKey(log.content_type, log.content_id)];
  const uniqueTitleMetadata = uniqueTitleLogs.map((log) => ({ log, data: metadata(log) })).filter((item) => item.data);
  const ratedTitles = new Set(watched.filter((log) => log.reaction !== null).map((log) => mediaKey(log.content_type, log.content_id)));
  const masterpieceTitles = new Set(watched.filter((log) => log.reaction === 2).map((log) => mediaKey(log.content_type, log.content_id)));
  const repeatCounts = new Map<string, number>();
  for (const log of watched) {
    if (log.content_type === "movie") repeatCounts.set(mediaKey("movie", log.content_id), (repeatCounts.get(mediaKey("movie", log.content_id)) || 0) + 1);
    else if (Number.isInteger(log.season) && Number.isInteger(log.episode) && log.season! > 0 && log.episode! > 0) repeatCounts.set(episodeKey(log), (repeatCounts.get(episodeKey(log)) || 0) + 1);
  }
  const rewatched = [...repeatCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const distinctRewatchedItems = [...repeatCounts.values()].filter((count) => count > 1).length;
  const datesByDay = new Map<string, Set<number>>();
  for (const log of movies) datesByDay.set(log.watched_date, (datesByDay.get(log.watched_date) || new Set()).add(log.content_id));
  const doubleFeatureDays = [...datesByDay.values()].filter((day) => day.size >= 2).length;

  const genreCounts = new Map<string, Set<string>>();
  const languageCounts = new Map<string, Set<string>>();
  const countryCounts = new Map<string, Set<string>>();
  const yearCounts = new Map<number, Set<string>>();
  const decadeCounts = new Map<number, Set<string>>();
  const actorCounts = new Map<string, Set<string>>();
  const lowVoteTitles = new Set<string>();
  const pre1980 = new Set<string>();
  const lowBudgetMovies = new Set<string>();
  const contrarianTitles = new Set<string>();
  const watchedMovieIds = new Set([...uniqueMovies.values()].map((log) => log.content_id));

  let watchMinutes = 0;
  for (const log of watched) {
    const data = metadata(log);
    const key = mediaKey(log.content_type, log.content_id);
    if (log.content_type === "movie") {
      if (typeof data?.runtime === "number" && data.runtime > 0) watchMinutes += data.runtime;
      if (typeof data?.budget === "number" && data.budget >= 0 && data.budget < 5_000_000) lowBudgetMovies.add(key);
    } else if (Number.isInteger(log.season) && Number.isInteger(log.episode) && log.season! > 0 && log.episode! > 0) {
      const runtime = data?.episode_runtime_by_key?.[`${log.season}:${log.episode}`];
      if (typeof runtime === "number" && runtime > 0) watchMinutes += runtime;
    }
  }

  for (const { log, data } of uniqueTitleMetadata) {
    const key = mediaKey(log.content_type, log.content_id);
    for (const genre of genres(data?.genres)) genreCounts.set(genre, (genreCounts.get(genre) || new Set()).add(key));
    const language = data?.original_language || data?.language;
    if (typeof language === "string" && language.trim()) languageCounts.set(language.trim().toLowerCase(), (languageCounts.get(language.trim().toLowerCase()) || new Set()).add(key));
    for (const country of metadataCountries(data!)) countryCounts.set(country, (countryCounts.get(country) || new Set()).add(key));
    const releaseDate = data?.release_date || data?.premiered;
    const year = releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) : NaN;
    if (Number.isInteger(year) && year >= 1888) {
      yearCounts.set(year, (yearCounts.get(year) || new Set()).add(key));
      decadeCounts.set(Math.floor(year / 10) * 10, (decadeCounts.get(Math.floor(year / 10) * 10) || new Set()).add(key));
      if (year < 1980) pre1980.add(key);
    }
    const actors = [...strings(data?.actors), ...(data?.cast_details || []).map((person) => person.name || "").filter(Boolean)];
    for (const actor of new Set(actors)) actorCounts.set(actor, (actorCounts.get(actor) || new Set()).add(key));
    if (typeof data?.vote_count === "number" && data.vote_count < 500) lowVoteTitles.add(key);
  }

  const latestRatedLogByTitle = new Map<string, MovieLog>();
  for (const log of watched) {
    if (log.reaction === null) continue;
    const key = mediaKey(log.content_type, log.content_id);
    const current = latestRatedLogByTitle.get(key);
    if (!current || (log.updated_at || log.created_at) > (current.updated_at || current.created_at)) latestRatedLogByTitle.set(key, log);
  }
  for (const log of latestRatedLogByTitle.values()) {
    const data = metadata(log);
    if (!data || typeof data.vote_count !== "number" || data.vote_count < 500 || typeof data.vote_average !== "number") continue;
    if (log.reaction === 0 && data.vote_average >= 7.5 || log.reaction === 2 && data.vote_average <= 5.0) {
      contrarianTitles.add(mediaKey(log.content_type, log.content_id));
    }
  }

  const seasonLogged = new Map<string, Set<string>>();
  for (const log of uniqueEpisodes.values()) {
    const key = mediaKey("tv", log.content_id);
    const seasonKey = `${key}:${log.season}`;
    seasonLogged.set(seasonKey, (seasonLogged.get(seasonKey) || new Set()).add(String(log.episode)));
  }
  const completedSeasonShows = new Map<string, Set<number>>();
  const completedEndedSeries = new Set<string>();
  const networks = new Set<string>();
  for (const [seriesKey, seriesLog] of uniqueSeries) {
    const data = metadata(seriesLog);
    if (!data) continue;
    const inventoryKnown = data.regular_episode_inventory_complete === true && Boolean(data.regular_episodes?.every((episode) => typeof episode.released === "boolean" || Boolean(episode.air_date)));
    const regularEpisodes = inventoryKnown ? data.regular_episodes!.filter((episode) => episode.season > 0 && (
      episode.released === true || (episode.released !== false && Boolean(episode.air_date) && episode.air_date! <= now.toISOString().slice(0, 10))
    )) : [];
    if (regularEpisodes.length) {
      const episodeSet = new Set(regularEpisodes.map((episode) => `${episode.season}:${episode.episode}`));
      const completedSeasons = new Set<number>();
      for (const episode of regularEpisodes) {
        const key = `${seriesKey}:${episode.season}`;
        const logged = seasonLogged.get(key);
        if (logged && regularEpisodes.filter((entry) => entry.season === episode.season).every((entry) => logged.has(String(entry.episode)))) completedSeasons.add(episode.season);
      }
      if (completedSeasons.size) completedSeasonShows.set(seriesKey, completedSeasons);
      const everyEpisodeLogged = [...episodeSet].every((item) => {
        const [season, episode] = item.split(":");
        return seasonLogged.get(`${seriesKey}:${season}`)?.has(episode);
      });
      if (data.status?.toLowerCase() === "ended" && everyEpisodeLogged) completedEndedSeries.add(seriesKey);
    }
    const names = [...strings(data.networks), ...(data.network?.name ? [data.network.name] : [])];
    if (completedEndedSeries.has(seriesKey)) names.forEach((name) => networks.add(name));
  }

  const seasonsAcrossThreeShows = [...completedSeasonShows.values()].reduce((sum, seasons) => sum + seasons.size, 0);
  const seasonsAcrossTenShows = completedSeasonShows.size >= 10 ? seasonsAcrossThreeShows : 0;
  const countriesWithThreeTitles = [...countryCounts.values()].filter((titles) => titles.size >= 3).length;
  const languagesWithThreeTitles = [...languageCounts.values()].filter((titles) => titles.size >= 3).length;
  const decadesWithTenTitles = [...decadeCounts.values()].filter((titles) => titles.size >= 10).length;
  const completedFranchises = new Set<number>();
  for (const log of uniqueMovies.values()) {
    const data = metadata(log);
    const collectionId = data?.collection_id || data?.belongs_to_collection?.id;
    const collectionIds = data?.collection_movie_ids;
    if (collectionId && collectionIds && collectionIds.length >= 3 && collectionIds.every((id) => watchedMovieIds.has(id))) completedFranchises.add(collectionId);
  }
  let completedDirectorFilmographies = 0;
  const directorFilmographies = new Map<string, Set<number>>();
  for (const log of uniqueMovies.values()) {
    const data = metadata(log);
    for (const [director, ids] of Object.entries(data?.released_feature_filmography_ids || {})) {
      const completedIds = ids.filter((id) => watchedMovieIds.has(id));
      if (ids.length >= 5 && completedIds.length === ids.length) directorFilmographies.set(director, new Set(ids));
    }
  }
  completedDirectorFilmographies = directorFilmographies.size;

  const ownNonImported = watched.filter((log) => !log.imported_from_csv && (log.notes || "").trim() !== "Imported from ratings CSV");
  const membershipMs = Date.parse(user.created_at);
  const reviewLogs = ownNonImported.filter((log) => log.notes?.trim());
  const reviewDates = reviewLogs.map((log) => log.created_at).filter(Boolean).sort();
  const reviewSpanMonths = reviewDates.length > 1
    ? (Date.parse(reviewDates[reviewDates.length - 1]) - Date.parse(reviewDates[0])) / (30.4375 * 86_400_000)
    : 0;
  const watchlist = args.watchlistLogs || logs.filter((log) => log.watch_later);
  const watchlistTitles = new Set(watchlist.map((log) => mediaKey(log.content_type, log.content_id)));
  const activeDates = ownNonImported.map((log) => log.created_at || "").filter(Boolean);
  const consecutiveActiveMonths = calculateConsecutiveMonths(activeDates);
  const profileComplete = Boolean(user.name?.trim() && user.username?.trim() && user.avatar_url && user.bio?.trim());

  let immortalMembershipYears = 0;
  if (Number.isFinite(membershipMs)) {
    const joined = new Date(membershipMs);
    for (let yearIndex = 0; yearIndex < 5; yearIndex += 1) {
      const start = new Date(joined);
      start.setUTCFullYear(joined.getUTCFullYear() + yearIndex);
      const end = new Date(joined);
      end.setUTCFullYear(joined.getUTCFullYear() + yearIndex + 1);
      if (end > now) break;
      const yearLogs = ownNonImported.filter((log) => {
        const time = Date.parse(`${log.watched_date}T00:00:00.000Z`);
        return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
      });
      const yearMovies = new Set(yearLogs.filter((log) => log.content_type === "movie").map((log) => log.content_id));
      const yearEpisodes = new Set(yearLogs.filter((log) => log.content_type === "tv" && Number.isInteger(log.season) && Number.isInteger(log.episode) && log.season! > 0 && log.episode! > 0).map(episodeKey));
      if (yearMovies.size / 50 + yearEpisodes.size / 100 >= 1) immortalMembershipYears += 1;
    }
  }

  const encyclopaediaProgress = Math.min(1, countryCounts.size / 75, languageCounts.size / 30, decadeCounts.size / 10);
  const metricSet = {
    uniqueMovies: uniqueMovies.size,
    uniqueEpisodes: uniqueEpisodes.size,
    ratedTitles: ratedTitles.size,
    masterpieceTitles: masterpieceTitles.size,
    doubleFeatureDays,
    maxEpisodesInSeries: Math.max(0, ...[...uniqueSeries.keys()].map((key) => uniqueEpisodes.size ? [...uniqueEpisodes.values()].filter((log) => mediaKey("tv", log.content_id) === key).length : 0)),
    reviews: reviewLogs.length,
    watchlistTitles: watchlistTitles.size,
    profileComplete: profileComplete ? 1 : 0,
    following: followingCount,
    completedSeasons: seasonsAcrossThreeShows,
    genres: genreCounts.size,
    rewatches: rewatched,
    languages: languageCounts.size,
    completedFranchises: completedFranchises.size,
    lowVoteTitles: lowVoteTitles.size,
    ensembleActorTitles: Math.max(0, ...[...actorCounts.values()].map((titles) => titles.size)),
    seasonsAcrossThreeShows: completedSeasonShows.size >= 3 ? seasonsAcrossThreeShows : 0,
    watchMinutes,
    countries: countryCounts.size,
    pre1980Titles: pre1980.size,
    lowBudgetMovies: lowBudgetMovies.size,
    distinctRewatchedItems,
    completedEndedSeries: completedEndedSeries.size,
    countriesWithThreeTitles,
    languagesWithThreeTitles,
    completedDirectorFilmographies,
    releaseYears: yearCounts.size,
    contrarianRatings: contrarianTitles.size,
    seasonsAcrossTenShows,
    reviewsAcrossTwelveMonths: reviewSpanMonths >= 12 ? reviewLogs.length : 0,
    decadesWithTenTitles,
    completedShowsAcrossTenNetworks: networks.size >= 10 ? completedEndedSeries.size : 0,
    consecutiveActiveMonths,
    encyclopaediaMilestones: encyclopaediaProgress,
    immortalMembershipYears,
  };
  return metricSet;
}
