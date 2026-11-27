import { type NextRequest } from "next/server";
import { fetchTmdb, getTmdbCacheTtlSeconds } from "@/lib/tmdb-transport";
import { validateTmdbProxyRequest } from "@/lib/tmdb-proxy-policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = Array.isArray(path) ? path.join("/") : path;
    const invalid = validateTmdbProxyRequest(pathname, request.nextUrl.searchParams);
    if (invalid) return Response.json({ error: invalid }, { status: 400 });
    const response = await fetchTmdb(pathname, Object.fromEntries(request.nextUrl.searchParams.entries()));
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    const cacheHeader = response.headers.get("x-tmdb-cache");
    const staleReason = response.headers.get("x-tmdb-stale-reason");

    const ttl = getTmdbCacheTtlSeconds(pathname);
    const headers = new Headers({
      "content-type": contentType,
      "cache-control": response.ok
        ? `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 3600)}`
        : "no-store",
    });

    if (cacheHeader) headers.set("x-tmdb-cache", cacheHeader);
    if (staleReason) headers.set("x-tmdb-stale-reason", staleReason);

    return new Response(body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TMDB proxy failed";
    return Response.json(
      {
        error: "TMDB proxy failed",
        message,
      },
      { status: 500 }
    );
  }
}
