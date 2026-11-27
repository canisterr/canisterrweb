import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getHonoursForUser, recalculateHonoursForUser } from "@/lib/server-honours";

export const dynamic = "force-dynamic";

async function authorizedUid(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  try {
    return (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const viewerId = await authorizedUid(request);
  if (!viewerId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = request.nextUrl.searchParams.get("userId") || viewerId;
  if (userId !== viewerId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const honours = await getHonoursForUser(viewerId);
    return NextResponse.json({ honours }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await authorizedUid(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    let body: { acceptedFollowId?: unknown } = {};
    try { body = await request.json(); } catch { /* Body is optional for self recalculation. */ }
    if (typeof body.acceptedFollowId === "string") {
      const relation = await getFirebaseAdminDatabase().ref(`follows/${body.acceptedFollowId}`).get();
      const follow = relation.val() as { follower_id?: string; following_id?: string; status?: string } | null;
      if (!follow || follow.following_id !== userId || follow.status !== "accepted" || !follow.follower_id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      await recalculateHonoursForUser(follow.follower_id);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const honours = await recalculateHonoursForUser(userId);
    return NextResponse.json({ honours }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Honours recalculation failed:", error);
    return NextResponse.json({
      error: "Could not recalculate honours.",
      ...(process.env.NODE_ENV !== "production" ? { detail: error instanceof Error ? error.message : String(error) } : {}),
    }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await authorizedUid(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { pins?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(body.pins) || body.pins.length > 3 || body.pins.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "Choose up to three honours." }, { status: 400 });
  }
  const pins = [...new Set(body.pins as string[])];
  try {
    const db = getFirebaseAdminDatabase();
    const [profile, honours] = await Promise.all([
      db.ref(`users/${userId}`).get(),
      db.ref(`honours/${userId}`).get(),
    ]);
    if (!profile.exists()) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const unlocked = (honours.val()?.achievements || {}) as Record<string, { unlocked?: boolean }>;
    if (pins.some((id) => !unlocked[id]?.unlocked)) return NextResponse.json({ error: "Only unlocked honours can be pinned." }, { status: 400 });
    await db.ref(`honours/${userId}/pins`).set(pins);
    return NextResponse.json({ pins });
  } catch {
    return NextResponse.json({ error: "Could not save pinned honours." }, { status: 503 });
  }
}
