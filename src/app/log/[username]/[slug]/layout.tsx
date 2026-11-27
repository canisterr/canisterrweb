import type { Metadata } from "next";
import { cache } from "react";
import { searchTmdbMovies } from "@/lib/tmdb-data";
import {
  parseMovieSlug,
  logMetadata,
  movieSchema,
  reviewSchema,
  personSchema,
  breadcrumbSchema,
  tmdbImage,
  reactionToRating,
  BASE_URL,
} from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ username: string; slug: string }>;
  children: React.ReactNode;
};

// Search TMDB by title + optional year, return first result.
const searchTmdbMovie = cache(async (titleHint: string, year: number | null) => {
  try {
    const data = await searchTmdbMovies(titleHint, { year: year ?? undefined, language: "en-US" });
    return (data.results?.[0] ?? null) as {
      id: number;
      title: string;
      overview: string;
      release_date: string;
      poster_path: string | null;
      backdrop_path: string | null;
      genre_ids: number[];
    } | null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const { titleHint, year } = parseMovieSlug(slug);
  const movie = await searchTmdbMovie(titleHint, year);

  if (!movie) {
    return {
      title: `${username}'s log`,
      description: `See ${username}'s movie log on Canisterr.`,
      robots: { index: true, follow: true },
    };
  }

  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : year;
  const posterUrl = tmdbImage(movie.poster_path, "w500");

  return logMetadata({
    username,
    movieTitle: movie.title,
    year: releaseYear,
    slug,
    posterUrl,
  });
}

export default async function LogPageLayout({ params, children }: Props) {
  const { username, slug } = await params;
  const { titleHint, year } = parseMovieSlug(slug);
  const movie = await searchTmdbMovie(titleHint, year);

  const releaseYear = movie?.release_date ? new Date(movie.release_date).getFullYear() : year;
  const posterUrl = tmdbImage(movie?.poster_path ?? null, "w500");

  return (
    <>
      {movie && (
        <>
          <JsonLd
            data={movieSchema({
              id: movie.id,
              title: movie.title,
              overview: movie.overview,
              release_date: movie.release_date,
              poster_path: movie.poster_path,
            })}
          />
          <JsonLd
            data={personSchema({ name: username, username })}
          />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", url: BASE_URL },
              { name: `@${username}`, url: `${BASE_URL}/profile/${username}` },
              {
                name: releaseYear ? `${movie.title} (${releaseYear})` : movie.title,
                url: `${BASE_URL}/movie/${movie.id}`,
              },
              { name: "Log", url: `${BASE_URL}/log/${username}/${slug}` },
            ])}
          />
        </>
      )}
      {children}
    </>
  );
}
