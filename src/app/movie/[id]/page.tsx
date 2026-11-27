import MoviePageClient from "@/components/movie/MoviePageClient";
import { getResolvedMoviePage } from "@/lib/movie-page-resolver";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await getResolvedMoviePage(id);
  return <MoviePageClient initialResolved={resolved} />;
}
