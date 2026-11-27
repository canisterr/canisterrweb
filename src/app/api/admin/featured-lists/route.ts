import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getAdminIdentity } from "@/lib/admin-auth";
import type { FeaturedList, FeaturedTitle } from "@/lib/featured-lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeTitle(value: unknown): FeaturedTitle | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
  const href = typeof item.href === "string" ? item.href.trim() : "";
  const media_type = item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : null;
  const media_id = Number(item.media_id);
  const poster_url = typeof item.poster_url === "string" ? item.poster_url.trim() : "";
  if (!title || !media_type || !Number.isSafeInteger(media_id) || media_id <= 0 || href !== `/${media_type}/${media_id}`) return null;
  if (poster_url && !poster_url.startsWith("https://")) return null;
  const releaseYear = typeof item.release_year === "string" ? item.release_year.slice(0, 4) : "";
  const note = typeof item.note === "string" ? item.note.trim().slice(0, 160) : "";
  return { title, href, poster_url, media_type, media_id, ...(releaseYear ? { release_year: releaseYear } : {}), ...(note ? { note } : {}) };
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function fromSnapshot(value: unknown): FeaturedList[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, Record<string, unknown>>).flatMap(([id, row]) => {
    if (!row || typeof row.title !== "string" || !Array.isArray(row.items)) return [];
    return [{ ...row, id, items: row.items.map(normalizeTitle).filter((item): item is FeaturedTitle => Boolean(item)) } as FeaturedList];
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function GET(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const lists = fromSnapshot((await getFirebaseAdminDatabase().ref("home_featured_lists").get()).val());
    return NextResponse.json({ lists }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load featured lists from the database." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 280) : "";
  const expiresAt = typeof body.expires_at === "string" && body.expires_at ? body.expires_at : "";
  const items = Array.isArray(body.items) ? body.items.map(normalizeTitle) : [];
  const validExpiry = !expiresAt || isIsoDate(expiresAt);
  if (!title || !validExpiry || !Array.isArray(body.items) || items.length < 1 || items.length > 50 || items.some((item) => !item)) {
    return NextResponse.json({ error: "Add a title, an optional valid expiry date, and between 1 and 50 movie or TV picks." }, { status: 400 });
  }
  try {
    const db = getFirebaseAdminDatabase();
    const id = typeof body.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(body.id) ? body.id : randomUUID();
    const ref = db.ref(`home_featured_lists/${id}`);
    const existing = (await ref.get()).val() as Partial<FeaturedList> | null;
    const now = new Date().toISOString();
    const list: FeaturedList = { id, title, description, active: body.active === true, ...(expiresAt ? { expires_at: expiresAt } : {}), items: items as FeaturedTitle[], created_at: existing?.created_at || now, updated_at: now };
    await ref.set(list);
    return NextResponse.json({ list }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Featured list save failed:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Could not save the featured list to the database.", ...(process.env.NODE_ENV === "development" ? { detail } : {}) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(body.id)) return NextResponse.json({ error: "Invalid list ID." }, { status: 400 });
  try {
    await getFirebaseAdminDatabase().ref(`home_featured_lists/${body.id}`).remove();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not delete the featured list from the database." }, { status: 503 });
  }
}
