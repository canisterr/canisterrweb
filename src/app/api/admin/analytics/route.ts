import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getAdminIdentity } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let cached: { expires: number; value: Record<string, unknown> } | null = null;

export async function GET(request: Request) {
  if (!await getAdminIdentity(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.value, { headers: { "Cache-Control": "private, max-age=60" } });
  try {
    const db = getFirebaseAdminDatabase();
    const [usersSnapshot, logsSnapshot] = await Promise.all([db.ref("users").get(), db.ref("movie_logs").get()]);
    const users = Object.entries((usersSnapshot.val() || {}) as Record<string, Record<string, unknown>>);
    const logs = Object.values((logsSnapshot.val() || {}) as Record<string, Record<string, unknown>>).filter((log) => log && log.watch_later !== true && log.watched_date);
    const since = Date.now() - 30 * 86400000;
    const activeIds = new Set<string>();
    const byUser = new Map<string, Set<string>>();
    let movieLogs = 0; let tvLogs = 0;
    for (const log of logs) {
      const userId = typeof log.user_id === "string" ? log.user_id : "";
      if (!userId) continue;
      const timestamp = Date.parse(String(log.watched_date));
      if (Number.isFinite(timestamp) && timestamp >= since) activeIds.add(userId);
      const type = log.content_type === "tv" || log.type === "tv" ? "tv" : "movie";
      if (type === "tv") tvLogs++; else movieLogs++;
      const set = byUser.get(userId) || new Set<string>(); set.add(type); byUser.set(userId, set);
    }
    const now = Date.now();
    const newUsers30d = users.filter(([, user]) => { const date = Date.parse(String(user.created_at || "")); return Number.isFinite(date) && date >= since; }).length;
    let movieOnly = 0; let tvOnly = 0; let both = 0; let noLogs = 0;
    for (const [id] of users) { const types = byUser.get(id); if (!types?.size) noLogs++; else if (types.has("movie") && types.has("tv")) both++; else if (types.has("tv")) tvOnly++; else movieOnly++; }
    const value = { totals: { users: users.length, newUsers30d, activeUsers30d: activeIds.size, logs: logs.length, movieLogs, tvLogs }, audience: { movieOnly, tvOnly, both, noLogs }, generatedAt: new Date(now).toISOString() };
    cached = { value, expires: now + 5 * 60 * 1000 };
    return NextResponse.json(value, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Could not load analytics." }, { status: 503 });
  }
}
