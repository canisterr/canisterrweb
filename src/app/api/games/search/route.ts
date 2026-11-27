import { NextRequest, NextResponse } from "next/server";
import { fetchTmdb } from "@/lib/tmdb-transport";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const type = request.nextUrl.searchParams.get("type") === "person" ? "person" : "title";
  if (query.length < 2) return NextResponse.json([]);
  try {
    const response = await fetchTmdb(type === "person" ? "search/person" : "search/movie", {
      query,
      include_adult: false,
      page: 1,
    });
    if (!response.ok) return NextResponse.json({ error: "TMDB search is temporarily unavailable." }, { status: 503 });
    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    const results = (payload.results || []).flatMap((item) => {
      const mediaType = type === "person" ? "person" : "movie";
      if (mediaType === "person") {
        const name = typeof item.name === "string" ? item.name : "";
        return name ? [{ id: Number(item.id), type: "person", name, image: typeof item.profile_path === "string" ? item.profile_path : null }] : [];
      }
      const name = typeof item.title === "string" ? item.title : "";
      if (!name) return [];
      const date = String(item.release_date || "");
      return [{ id: Number(item.id), type: "movie", name, image: typeof item.poster_path === "string" ? item.poster_path : null, year: date.slice(0, 4) }];
    }).slice(0, 8);
    return NextResponse.json(results, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ error: "TMDB search is temporarily unavailable." }, { status: 503 });
  }
}
