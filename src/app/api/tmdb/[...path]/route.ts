import { type NextRequest } from "next/server";
import { fetchTmdb } from "@/lib/tmdb-transport";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathname = Array.isArray(path) ? path.join("/") : path;
    const response = await fetchTmdb(pathname, Object.fromEntries(request.nextUrl.searchParams.entries()));
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    const cacheHeader = response.headers.get("x-tmdb-cache");
    const staleReason = response.headers.get("x-tmdb-stale-reason");

    const headers = new Headers({
      "content-type": contentType,
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
