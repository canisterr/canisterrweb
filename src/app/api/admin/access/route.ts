import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getAdminIdentity(request);
  return NextResponse.json(
    { isAdmin: Boolean(identity) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
