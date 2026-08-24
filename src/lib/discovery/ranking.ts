import type { DiscoveryMovie, MoodDefinition, SessionTaste } from "./discoveryTypes";
import { getSessionTasteScore } from "./sessionTaste";

function getReleaseYear(movie: DiscoveryMovie): number | null {
  const year = Number(movie.release_date?.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export function getDiscoveryMovieScore(
  movie: DiscoveryMovie,
  mood: MoodDefinition,
  selectedProviderIds: number[],
  taste: SessionTaste,
  alreadySeenIds: Set<number>
): number {
  const genreIds = movie.genre_ids || movie.genres || [];
  const primaryGenres = new Set(mood.genres.filter((genre) => genre.priority === "primary").map((genre) => genre.id));
  const secondaryGenres = new Set(mood.genres.filter((genre) => genre.priority === "secondary").map((genre) => genre.id));
  const availableProviderIds = new Set(movie.providerAvailability?.providerIds || []);

  let score = 0;
  genreIds.forEach((genreId) => {
    if (primaryGenres.has(genreId)) score += 90;
    if (secondaryGenres.has(genreId)) score += 45;
  });

  score += (movie.keywordIds || []).length * 9;

  if (selectedProviderIds.length > 0) {
    const providerMatch = selectedProviderIds.some((id) => availableProviderIds.has(id));
    score += providerMatch ? 100 : -90;
  }

  score += Math.min(movie.vote_average || 0, 10) * 14;
  score += Math.min(movie.vote_count || 0, 3500) * 0.025;
  score += Math.min(movie.popularity || 0, 160) * 0.7;

  const year = getReleaseYear(movie);
  if (year && year >= 1980) score += 8;
  if (!movie.poster_path) score -= 80;
  if (alreadySeenIds.has(movie.id)) score -= 1000;

  score += getSessionTasteScore(movie, taste);

  return score;
}

export function rankDiscoveryMovies(
  movies: DiscoveryMovie[],
  mood: MoodDefinition,
  selectedProviderIds: number[],
  taste: SessionTaste,
  alreadySeenIds: Set<number>
): DiscoveryMovie[] {
  return movies
    .slice()
    .sort((a, b) => getDiscoveryMovieScore(b, mood, selectedProviderIds, taste, alreadySeenIds) - getDiscoveryMovieScore(a, mood, selectedProviderIds, taste, alreadySeenIds));
}
