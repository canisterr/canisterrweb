import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin-auth";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTmdbPosterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "image.tmdb.org" && url.pathname.startsWith("/t/p/");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const poster = (await getFirebaseAdminDatabase().ref("site_settings/login_page_poster").get()).val() || null;
    return NextResponse.json({ poster }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the login poster." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  let body: { title?: unknown; poster_url?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const poster_url = typeof body.poster_url === "string" ? body.poster_url.trim() : "";
  if (!title || !isTmdbPosterUrl(poster_url) || poster_url.length > 2048) {
    return NextResponse.json({ error: "Choose a movie poster before saving." }, { status: 400 });
  }
  try {
    const poster = { title, poster_url, updated_at: new Date().toISOString() };
    await getFirebaseAdminDatabase().ref("site_settings/login_page_poster").set(poster);
    return NextResponse.json({ poster }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not save the login poster." }, { status: 503 });
  }
}
