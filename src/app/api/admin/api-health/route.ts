import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin-auth";
import { fetchTmdb } from "@/lib/tmdb-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function timed(label: string, run: () => Promise<Response>) {
  const started = Date.now();
  try { const response = await run(); return { provider: label, ok: response.ok, status: response.status, ms: Date.now() - started }; }
  catch { return { provider: label, ok: false, status: 0, ms: Date.now() - started }; }
}

export async function POST(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const results = await Promise.all([
    timed("TMDB", () => fetchTmdb("search/movie", { query: "Arrival", page: 1 }, { cache: "no-store" })),
    timed("TVMaze", () => fetch("https://api.tvmaze.com/search/shows?q=Friends", { cache: "no-store", signal: AbortSignal.timeout(8000) })),
  ]);
  return NextResponse.json({ checkedAt: new Date().toISOString(), requests: results, totalMs: results.reduce((sum, row) => sum + row.ms, 0) }, { headers: { "Cache-Control": "private, no-store" } });
}
