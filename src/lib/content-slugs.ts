import type { Movie } from "@/types";
import { getMovieDetails, searchMovies } from "@/lib/tmdb";
import { getShowDetails, searchShows, type ShowDetails } from "@/lib/tvmaze";

const SLUG_SEPARATOR = "--";
const DEFAULT_MOVIE_DISAMBIGUATOR = "feature-film";
const DEFAULT_TV_DISAMBIGUATOR = "tv-series";

type SlugMovie = Pick<Movie, "id" | "title" | "director" | "language" | "release_date">;
type SlugShow = Pick<
  ShowDetails,
  "id" | "title" | "name" | "network" | "language" | "premiered" | "release_date" | "crew_details"
>;

type ResolvedMovieRoute = {
  movie: NonNullable<Awaited<ReturnType<typeof getMovieDetails>>>;
  canonicalSlug: string;
  canonicalPath: string;
};

type ResolvedTvRoute = {
  show: NonNullable<Awaited<ReturnType<typeof getShowDetails>>>;
  canonicalSlug: string;
  canonicalPath: string;
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getYearFromDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})/);
  return match ? match[1] : null;
}

function getLanguageShortForm(language: string | null | undefined): string | null {
  if (!language) return null;

  const normalized = language.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.length === 2) return normalized;
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("it")) return "it";
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("hi")) return "hi";
  if (normalized.startsWith("tr")) return "tr";
  if (normalized.startsWith("ru")) return "ru";
  return normalized.slice(0, 2);
}

export function slugifyContentLabel(value: string): string {
  return normalizeToken(value)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toAlphabeticToken(id: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let value = Math.max(1, Math.trunc(Math.abs(id)));
  let token = "";

  while (value > 0) {
    const remainder = value % alphabet.length;
    token = `${alphabet[remainder]}${token}`;
    value = Math.floor(value / alphabet.length);
  }

  return token.padStart(3, "a");
}

function isNumericRouteParam(param: string): boolean {
  return /^\d+$/.test(param.trim());
}

function parseSlugCore(slug: string): { titleHint: string; year: string | null } {
  const [titleSegment] = decodeURIComponent(slug).split(SLUG_SEPARATOR);
  const parts = titleSegment.split("-").filter(Boolean);
  const yearIndex = parts.findIndex((part) => /^\d{4}$/.test(part));
  const year = yearIndex >= 0 ? parts[yearIndex] : null;
  const titleHint = (yearIndex >= 0 ? parts.slice(0, yearIndex) : parts).join(" ").trim();
  return { titleHint, year };
}

function getSlugDisambiguator(slug: string): string | null {
  const [, disambiguator] = decodeURIComponent(slug).split(SLUG_SEPARATOR);
  return disambiguator ? slugifyContentLabel(disambiguator) : null;
}

function getMovieDisambiguator(movie: SlugMovie): string {
  return slugifyContentLabel(movie.director || "") || DEFAULT_MOVIE_DISAMBIGUATOR;
}

function getTvDisambiguator(show: SlugShow): string {
  const creator =
    show.crew_details?.find((person) => {
      const job = normalizeToken(person.job || "");
      return job === "creator" || job === "created by" || job === "director";
    })?.name || "";
  const networkName =
    typeof show.network === "string"
      ? show.network
      : show.network?.name || show.language || "";
  return slugifyContentLabel(creator || networkName) || DEFAULT_TV_DISAMBIGUATOR;
}

function filterMoviesWithSameTitle(movie: SlugMovie, candidates: SlugMovie[]): SlugMovie[] {
  const normalizedTitle = normalizeToken(movie.title);
  return candidates.filter((candidate) => normalizeToken(candidate.title) === normalizedTitle);
}

function filterShowsWithSameTitle(show: SlugShow, candidates: SlugShow[]): SlugShow[] {
  const normalizedTitle = normalizeToken(show.title || show.name || "");
  return candidates.filter(
    (candidate) => normalizeToken(candidate.title || candidate.name || "") === normalizedTitle
  );
}

export function buildMovieSlug(movie: SlugMovie, candidates: SlugMovie[] = [movie]): string {
  const year = getYearFromDate(movie.release_date);
  const language = getLanguageShortForm(movie.language);
  const baseSlug = `${slugifyContentLabel(movie.title) || "movie"}${year ? `-${year}` : ""}`;
  const disambiguator = getMovieDisambiguator(movie);
  const slugCore = `${baseSlug}${SLUG_SEPARATOR}${disambiguator}${language ? `${SLUG_SEPARATOR}${language}` : ""}`;
  const sameSlugCoreMovies = filterMoviesWithSameTitle(movie, candidates).filter(
    (candidate) =>
      getYearFromDate(candidate.release_date) === year &&
      getMovieDisambiguator(candidate) === disambiguator &&
      getLanguageShortForm(candidate.language) === language
  );

  if (sameSlugCoreMovies.length <= 1) {
    return slugCore;
  }

  return `${slugCore}${SLUG_SEPARATOR}${toAlphabeticToken(movie.id)}`;
}

export function buildMoviePath(movie: SlugMovie, candidates: SlugMovie[] = [movie]): string {
  return `/movie/${buildMovieSlug(movie, candidates)}`;
}

export function buildTvSlug(show: SlugShow, candidates: SlugShow[] = [show]): string {
  const year = getYearFromDate(show.premiered || show.release_date);
  const language = getLanguageShortForm(show.language);
  const baseSlug = `${slugifyContentLabel(show.title || show.name || "") || "tv-show"}${year ? `-${year}` : ""}`;
  const disambiguator = getTvDisambiguator(show);
  const slugCore = `${baseSlug}${SLUG_SEPARATOR}${disambiguator}${language ? `${SLUG_SEPARATOR}${language}` : ""}`;
  const sameSlugCoreShows = filterShowsWithSameTitle(show, candidates).filter(
    (candidate) =>
      getYearFromDate(candidate.premiered || candidate.release_date) === year &&
      getTvDisambiguator(candidate) === disambiguator &&
      getLanguageShortForm(candidate.language) === language
  );

  if (sameSlugCoreShows.length <= 1) {
    return slugCore;
  }

  return `${slugCore}${SLUG_SEPARATOR}${toAlphabeticToken(show.id)}`;
}

export function buildTvPath(show: SlugShow, candidates: SlugShow[] = [show]): string {
  return `/tv/${buildTvSlug(show, candidates)}`;
}

export function buildMovieUrlLike(movie: SlugMovie, candidates: SlugMovie[] = [movie]): string {
  return buildMoviePath(movie, candidates);
}

export function buildTvUrlLike(show: SlugShow, candidates: SlugShow[] = [show]): string {
  return buildTvPath(show, candidates);
}

async function loadMovieSlugCandidates(titleHint: string, year: string | null) {
  const yearQuery = year ? `${titleHint} ${year}` : titleHint;
  const primaryResults = await searchMovies(yearQuery, 1);
  const fallbackResults = year ? await searchMovies(titleHint, 1) : [];
  const searchResults = [...primaryResults, ...fallbackResults];
  const normalizedHint = normalizeToken(titleHint);
  const matchingIds = Array.from(
    new Set(
      searchResults
        .filter((result) => normalizeToken(result.title) === normalizedHint)
        .slice(0, 8)
        .map((result) => result.id)
    )
  );

  const matches = await Promise.all(matchingIds.map((id) => getMovieDetails(id)));
  return matches.filter((movie): movie is NonNullable<typeof movie> => Boolean(movie));
}

async function loadTvSlugCandidates(titleHint: string, year: string | null) {
  const yearQuery = year ? `${titleHint} ${year}` : titleHint;
  const primaryResults = await searchShows(yearQuery);
  const fallbackResults = year ? await searchShows(titleHint) : [];
  const searchResults = [...primaryResults, ...fallbackResults];
  const normalizedHint = normalizeToken(titleHint);
  const matchingIds = Array.from(
    new Set(
      searchResults
        .filter((result) => normalizeToken(result.title || result.name || "") === normalizedHint)
        .slice(0, 8)
        .map((result) => result.id)
    )
  );

  const matches = await Promise.all(matchingIds.map((id) => getShowDetails(id)));
  return matches.filter((show): show is NonNullable<typeof show> => Boolean(show));
}

export async function resolveMovieRouteParam(param: string): Promise<ResolvedMovieRoute | null> {
  const decodedParam = decodeURIComponent(param).trim();
  if (!decodedParam) return null;

  if (isNumericRouteParam(decodedParam)) {
    const movie = await getMovieDetails(Number(decodedParam));
    if (!movie) return null;

    const candidates = await loadMovieSlugCandidates(movie.title, getYearFromDate(movie.release_date));
    const canonicalSlug = buildMovieSlug(movie, candidates.length > 0 ? candidates : [movie]);
    return {
      movie,
      canonicalSlug,
      canonicalPath: `/movie/${canonicalSlug}`,
    };
  }

  const { titleHint, year } = parseSlugCore(decodedParam);
  const candidates = await loadMovieSlugCandidates(titleHint, year);
  if (candidates.length === 0) return null;

  const requestedDisambiguator = getSlugDisambiguator(decodedParam);
  const matchedMovie =
    candidates.find((candidate) => buildMovieSlug(candidate, candidates) === decodedParam) ||
    candidates.find(
      (candidate) =>
        year &&
        getYearFromDate(candidate.release_date) === year &&
        requestedDisambiguator &&
        requestedDisambiguator !== DEFAULT_MOVIE_DISAMBIGUATOR &&
        getMovieDisambiguator(candidate) === requestedDisambiguator
    ) ||
    candidates.find(
      (candidate) =>
        year &&
        getYearFromDate(candidate.release_date) === year &&
        requestedDisambiguator === DEFAULT_MOVIE_DISAMBIGUATOR
    ) ||
    (candidates.length === 1 ? candidates[0] : null);

  if (!matchedMovie) return null;

  const canonicalSlug = buildMovieSlug(matchedMovie, candidates);
  return {
    movie: matchedMovie,
    canonicalSlug,
    canonicalPath: `/movie/${canonicalSlug}`,
  };
}

export async function resolveTvRouteParam(param: string): Promise<ResolvedTvRoute | null> {
  const decodedParam = decodeURIComponent(param).trim();
  if (!decodedParam) return null;

  if (isNumericRouteParam(decodedParam)) {
    const show = await getShowDetails(Number(decodedParam));
    if (!show) return null;

    const candidates = await loadTvSlugCandidates(show.title || show.name || "", getYearFromDate(show.premiered || show.release_date));
    const canonicalSlug = buildTvSlug(show, candidates.length > 0 ? candidates : [show]);
    return {
      show,
      canonicalSlug,
      canonicalPath: `/tv/${canonicalSlug}`,
    };
  }

  const { titleHint, year } = parseSlugCore(decodedParam);
  const candidates = await loadTvSlugCandidates(titleHint, year);
  if (candidates.length === 0) return null;

  const requestedDisambiguator = getSlugDisambiguator(decodedParam);
  const matchedShow =
    candidates.find((candidate) => buildTvSlug(candidate, candidates) === decodedParam) ||
    candidates.find(
      (candidate) =>
        year &&
        getYearFromDate(candidate.premiered || candidate.release_date) === year &&
        requestedDisambiguator &&
        requestedDisambiguator !== DEFAULT_TV_DISAMBIGUATOR &&
        getTvDisambiguator(candidate) === requestedDisambiguator
    ) ||
    candidates.find(
      (candidate) =>
        year &&
        getYearFromDate(candidate.premiered || candidate.release_date) === year &&
        requestedDisambiguator === DEFAULT_TV_DISAMBIGUATOR
    ) ||
    candidates.find(
      (candidate) =>
        year &&
        getYearFromDate(candidate.premiered || candidate.release_date) === year
    ) ||
    (candidates.length === 1 ? candidates[0] : null);

  if (!matchedShow) return null;

  const canonicalSlug = buildTvSlug(matchedShow, candidates);
  return {
    show: matchedShow,
    canonicalSlug,
    canonicalPath: `/tv/${canonicalSlug}`,
  };
}
