import { calculatePassportStats, getPassportMovieOrigin } from "./passport";
import type { Movie, MovieLogWithContent } from "@/types";

function movie(id: number, patch: Partial<Movie>): Movie {
  return { id, title: `Film ${id}`, language: null, country: null, countries: null, ...patch } as Movie;
}

function watched(content: Movie, id: string): MovieLogWithContent {
  return { id, content_id: content.id, content_type: "movie", watched_date: "2026-09-30", watch_later: false, content } as MovieLogWithContent;
}

const euroTrip = movie(9352, {
  language: "en",
  production_companies: [
    { name: "The Montecito Picture Company", origin_country: "US" },
    { name: "DreamWorks Pictures", origin_country: "US" },
    { name: "Czech service company", origin_country: "CZ" },
  ],
  production_countries: [
    { name: "United States", iso_3166_1: "US" },
    { name: "Czech Republic", iso_3166_1: "CZ" },
  ],
});
const frenchFilm = movie(2, {
  language: "fr",
  production_companies: [
    { name: "US partner", origin_country: "US" },
    { name: "French producer", origin_country: "FR" },
  ],
  production_countries: [
    { name: "United States", iso_3166_1: "US" },
    { name: "France", iso_3166_1: "FR" },
  ],
});
const britishFilm = movie(3, {
  language: "en",
  origin_countries: ["GB"],
  production_companies: [{ name: "US partner", origin_country: "US" }],
  production_countries: [
    { name: "United States", iso_3166_1: "US" },
    { name: "United Kingdom", iso_3166_1: "GB" },
  ],
});

if (getPassportMovieOrigin(euroTrip)?.code !== "US") throw new Error("EuroTrip should count as American");
if (getPassportMovieOrigin(frenchFilm)?.code !== "FR") throw new Error("Original French language should resolve a close production tie");
if (getPassportMovieOrigin(britishFilm)?.code !== "GB") throw new Error("British origin should beat an American company address");
if (getPassportMovieOrigin(movie(4, { language: "en" })) !== null) throw new Error("English language alone cannot assign a country");

const firstWatch = watched(euroTrip, "a");
firstWatch.watched_date = "2026-09-01";
const latestWatch = watched(euroTrip, "b");
const stats = calculatePassportStats([firstWatch, latestWatch, watched(frenchFilm, "c")]);
if (stats.totalMovies !== 2 || stats.countries.length !== 2 || stats.countries.some((country) => country.code === "CZ")) {
  throw new Error("A movie must count once in one country");
}
const americanStamp = stats.countries.find((country) => country.code === "US");
if (americanStamp?.films[0].watched_date !== "2026-09-30" || americanStamp.firstDate !== "2026-09-01") {
  throw new Error("Rewatches must use the latest list date and earliest first visit");
}
if (stats.westPercent !== 50 || stats.hemisphereFilmCount !== 2) {
  throw new Error("US and French films should fall on opposite sides of Greenwich");
}
const indianFilm = movie(5, { origin_countries: ["IN"], language: "hi" });
const westHeavy = calculatePassportStats([
  watched(euroTrip, "west-1"),
  watched(movie(6, { origin_countries: ["US"] }), "west-2"),
  watched(movie(7, { origin_countries: ["US"] }), "west-3"),
  watched(indianFilm, "east-1"),
]);
if (westHeavy.westPercent !== 75 || westHeavy.hemisphereFilmCount !== 4) {
  throw new Error("Three US films and one Indian film should be 75% west");
}

console.log("Passport nationality and hemisphere smoke test passed");
