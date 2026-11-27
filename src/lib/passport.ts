import type { Movie, MovieLogWithContent } from "@/types";
import { COUNTRY_NAME_TO_CODE } from "./passport-country-codes";
import { getCountryHemisphere } from "./passport-hemispheres";

export type PassportCountry = {
  code: string | null;
  name: string;
  count: number;
  films: MovieLogWithContent[];
  firstFilm: MovieLogWithContent;
  firstDate: string;
  weeklyCount: number;
  level: string;
  nextLevel: { name: string; remaining: number } | null;
};

const LEVELS = [
  { count: 50, name: "Obsessed" },
  { count: 25, name: "Local" },
  { count: 10, name: "Frequent Visitor" },
  { count: 5, name: "Regular Visitor" },
  { count: 3, name: "Explorer" },
  { count: 1, name: "Discovered" },
];

const NATIONALITIES: Record<string, string> = {
  "United States of America": "American", "United States": "American", India: "Indian",
  France: "French", Japan: "Japanese", "South Korea": "South Korean",
  "United Kingdom": "British", Italy: "Italian", Germany: "German",
  Spain: "Spanish", Canada: "Canadian", Australia: "Australian",
  "Czech Republic": "Czech", Czechia: "Czech",
  Argentina: "Argentine", Brazil: "Brazilian", Mexico: "Mexican",
  China: "Chinese", Sweden: "Swedish", Iran: "Iranian",
};

// Original language is supporting evidence only. In particular, English must
// never create a US or UK candidate without production evidence.
const LANGUAGE_COUNTRIES: Record<string, readonly string[]> = {
  en: ["US", "GB", "CA", "AU", "IE", "NZ", "IN", "ZA"],
  fr: ["FR", "CA", "BE", "CH", "LU"],
  de: ["DE", "AT", "CH"],
  es: ["ES", "MX", "AR", "CO", "CL", "PE", "UY", "VE"],
  pt: ["PT", "BR"],
  hi: ["IN"], bn: ["IN", "BD"], ta: ["IN"], te: ["IN"],
  ml: ["IN"], mr: ["IN"], pa: ["IN", "PK"], ur: ["PK", "IN"],
  ja: ["JP"], ko: ["KR"], zh: ["CN", "TW", "HK", "SG"],
  yue: ["HK", "CN"], fa: ["IR", "AF"], tr: ["TR"],
  it: ["IT", "CH"], nl: ["NL", "BE"], sv: ["SE", "FI"],
  da: ["DK"], no: ["NO"], fi: ["FI"], pl: ["PL"],
  cs: ["CZ"], ru: ["RU"], uk: ["UA"], he: ["IL"],
};

export function getCountryCode(name: string): string | null {
  return COUNTRY_NAME_TO_CODE[name.trim()] || null;
}

function getCountryName(code: string, fallback: string): string {
  if (code === "US") return "United States";
  if (code === "CZ") return "Czech Republic";
  if (code === "KR") return "South Korea";
  if (code === "GB") return "United Kingdom";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || fallback;
  } catch {
    return fallback;
  }
}

export function countryFlag(name: string): string {
  const code = /^[A-Z]{2}$/.test(name) ? name : getCountryCode(name);
  return code ? String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0))) : "🌍";
}

export function getPassportMovieOrigin(movie: Movie): {
  code: string | null;
  name: string;
  source: "studio" | "origin" | "production";
  studio: string | null;
  languageMatched: boolean;
} | null {
  type Candidate = {
    code: string;
    score: number;
    origin: boolean;
    studios: string[];
    production: boolean;
    languageMatched: boolean;
    order: number;
  };
  const candidates = new Map<string, Candidate>();
  const candidateFor = (code: string) => {
    const existing = candidates.get(code);
    if (existing) return existing;
    const entry: Candidate = { code, score: 0, origin: false, studios: [], production: false, languageMatched: false, order: candidates.size };
    candidates.set(code, entry);
    return entry;
  };

  for (const code of new Set(movie.origin_countries || [])) {
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const candidate = candidateFor(code);
    candidate.origin = true;
    candidate.score += 6;
  }
  for (const company of movie.production_companies || []) {
    const code = company.origin_country;
    if (!code || !/^[A-Z]{2}$/.test(code)) continue;
    const candidate = candidateFor(code);
    candidate.studios.push(company.name);
    if (candidate.studios.length <= 2) candidate.score += 3;
  }
  const productionCountries = movie.production_countries?.length
    ? movie.production_countries
    : (movie.countries?.length ? movie.countries : [movie.country])
      .filter((name): name is string => Boolean(name))
      .map((name) => ({ name, iso_3166_1: getCountryCode(name) }));
  for (const country of productionCountries) {
    const code = country.iso_3166_1 || getCountryCode(country.name);
    if (!code || !/^[A-Z]{2}$/.test(code)) continue;
    const candidate = candidateFor(code);
    if (!candidate.production) candidate.score += 2;
    candidate.production = true;
  }

  if (!candidates.size) {
    const fallbackName = movie.countries?.[0] || movie.country;
    return fallbackName ? { code: null, name: fallbackName, source: "production", studio: null, languageMatched: false } : null;
  }

  const language = movie.language?.toLowerCase().split("-")[0] || "";
  const languageCountries = LANGUAGE_COUNTRIES[language] || [];
  for (const candidate of candidates.values()) {
    if (languageCountries.includes(candidate.code)) {
      candidate.score += 1;
      candidate.languageMatched = true;
    }
  }
  const best = [...candidates.values()].sort((a, b) =>
    b.score - a.score || Number(b.origin) - Number(a.origin) ||
    b.studios.length - a.studios.length || Number(b.production) - Number(a.production) || a.order - b.order
  )[0];
  return {
    code: best.code,
    name: getCountryName(best.code, best.code),
    source: best.origin ? "origin" : best.studios.length ? "studio" : "production",
    studio: best.studios[0] || null,
    languageMatched: best.languageMatched,
  };
}

export function getCountryLevel(count: number) {
  const level = LEVELS.find((item) => count >= item.count)?.name || "Unexplored";
  const next = [...LEVELS].reverse().find((item) => item.count > count);
  return { level, nextLevel: next ? { name: next.name, remaining: next.count - count } : null };
}

export function calculatePassportStats(logs: MovieLogWithContent[], now = new Date()) {
  const watchedLogs = logs.filter((log) => log.content_type === "movie" && !log.watch_later && Boolean(log.watched_date));
  const watchedByMovie = new Map<number, MovieLogWithContent>();
  const firstByCountry = new Map<string, MovieLogWithContent>();
  for (const log of watchedLogs) {
    const previous = watchedByMovie.get(log.content_id);
    if (!previous || log.watched_date > previous.watched_date ||
      (log.watched_date === previous.watched_date && (log.created_at || "") > (previous.created_at || ""))) {
      watchedByMovie.set(log.content_id, log);
    }
    const origin = getPassportMovieOrigin(log.content as Movie);
    if (!origin) continue;
    const key = origin.code || origin.name;
    const first = firstByCountry.get(key);
    if (!first || log.watched_date < first.watched_date ||
      (log.watched_date === first.watched_date && (log.created_at || "") < (first.created_at || ""))) {
      firstByCountry.set(key, log);
    }
  }
  const watched = [...watchedByMovie.values()];
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const byCountry = new Map<string, { code: string | null; name: string; films: MovieLogWithContent[] }>();
  let runtime = 0;

  for (const log of watched) {
    runtime += Math.max(0, Number(log.content.runtime) || 0);
    const origin = getPassportMovieOrigin(log.content as Movie);
    if (!origin) continue;
    const key = origin.code || origin.name;
    const entry = byCountry.get(key) || { code: origin.code, name: origin.name, films: [] };
    entry.films.push(log);
    byCountry.set(key, entry);
  }

  const countries: PassportCountry[] = Array.from(byCountry.values(), ({ code, name, films }) => {
    const chronological = [...films].sort((a, b) => a.watched_date.localeCompare(b.watched_date));
    const firstFilm = firstByCountry.get(code || name) || chronological[0];
    return {
      code, name, count: films.length, films: chronological, firstFilm,
      firstDate: firstFilm.watched_date,
      weeklyCount: films.filter((film) => new Date(`${film.watched_date}T00:00:00`) >= weekStart).length,
      ...getCountryLevel(films.length),
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const migration = [...countries].sort((a, b) => a.firstDate.localeCompare(b.firstDate));
  const latest = [...migration].reverse()[0] || null;
  const west = countries.filter((item) => getCountryHemisphere(item.code || getCountryCode(item.name)) === "west")
    .reduce((sum, item) => sum + item.count, 0);
  const east = countries.filter((item) => getCountryHemisphere(item.code || getCountryCode(item.name)) === "east")
    .reduce((sum, item) => sum + item.count, 0);
  const hemisphereFilmCount = west + east;
  const westPercent = hemisphereFilmCount ? Math.round((west / hemisphereFilmCount) * 100) : 50;
  const nationality = countries[0] ? NATIONALITIES[countries[0].name] || `${countries[0].name} cinema` : null;

  return {
    totalMovies: watched.length, runtime, countries, migration, latest, nationality,
    worldPercentage: (countries.length / 195) * 100,
    weeklyFilms: watched.filter((film) => new Date(`${film.watched_date}T00:00:00`) >= weekStart).length,
    newThisWeek: migration.filter((country) => new Date(`${country.firstDate}T00:00:00`) >= weekStart),
    westPercent, hemisphereFilmCount,
  };
}
