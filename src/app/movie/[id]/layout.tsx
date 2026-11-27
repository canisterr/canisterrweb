import type { Metadata } from "next";
import { movieMetadata, movieSchema, breadcrumbSchema, BASE_URL } from "@/lib/seo";
import { getResolvedMoviePage } from "@/lib/movie-page-resolver";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const resolved = await getResolvedMoviePage(id);
  if (!resolved) return { title: "Movie | Canisterr" };
  return movieMetadata(resolved.movie, resolved.canonicalPath);
}

export default async function MovieLayout({ params, children }: Props) {
  const { id } = await params;
  const resolved = await getResolvedMoviePage(id);
  const movie = resolved?.movie;

  return (
    <>
      {movie && (
        <>
          <JsonLd data={movieSchema(movie, resolved.canonicalPath)} />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", url: BASE_URL },
              { name: "Movies", url: `${BASE_URL}/all-movies` },
              { name: movie.title, url: `${BASE_URL}${resolved.canonicalPath}` },
            ])}
          />
        </>
      )}
      {children}
    </>
  );
}
