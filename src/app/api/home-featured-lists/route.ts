import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import type { FeaturedList } from "@/lib/featured-lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const value = (await getFirebaseAdminDatabase().ref("home_featured_lists").get()).val() as Record<string, FeaturedList> | null;
    const today = new Date().toISOString().slice(0, 10);
    const lists = Object.entries(value || {}).map(([id, list]) => ({ ...list, id })).filter((list) => list.active && list.items?.length && (!list.expires_at || list.expires_at >= today)).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    return NextResponse.json({ lists }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ lists: [] }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
}
