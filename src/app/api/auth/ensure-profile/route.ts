import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { ensureUserProfileRecord } from "@/lib/server-user-profile";

type EnsureProfileBody = {
  idToken?: string;
  name?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: EnsureProfileBody;

  try {
    body = (await request.json()) as EnsureProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const idToken = body.idToken?.trim();
  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const decodedToken = await auth.verifyIdToken(idToken);
    const user = await ensureUserProfileRecord({
      uid: decodedToken.uid,
      preferredName: body.name,
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile repair failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
